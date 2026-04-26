// Kimi Radio Tauri shell.
//
// Owns:
//   1. Spawning + supervising the bundled `kimi-server` sidecar (Bun-compiled
//      Express + WS + LLM/TTS/SC adapters).
//   2. Discovering its random port from stdout (`KIMI_PORT=<n>`) and exposing
//      it to the webview via `get_server_port` + a `server-ready` event.
//   3. Per-user paths: SQLite in app-data, TTS cache in app-cache.
//   4. BYOK: API keys stored via tauri-plugin-store (encrypted on disk),
//      injected into the sidecar's env on (re)spawn. `apply_api_keys` Tauri
//      command kills the sidecar and respawns it with the new env so changes
//      take effect immediately.
//   5. System tray: rose icon in the menu bar; click toggles main window
//      visibility, right-click menu has Show / Hide pet / Quit.
//   6. Pet window: secondary always-on-top borderless 480x110 window
//      loading the same webview at hash route #/pet, mounting only the
//      MiniStatusBar component.

use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_store::StoreExt;

// Shared port + sidecar handle so we can kill/respawn on BYOK key changes.
#[derive(Default)]
pub struct ServerState {
    port: Mutex<Option<u16>>,
    child: Mutex<Option<CommandChild>>,
}

// Keys we forward to the sidecar from the BYOK store. Anything not in this
// list is ignored even if it's in the store, so a typo can't pollute env.
const BYOK_KEYS: &[&str] = &[
    "KIMI_API_KEY",
    "OPENAI_API_KEY",
    "CLAUDE_API_KEY",
    "MINIMAX_API_KEY",
    "OPENWEATHER_KEY",
    "TTS_VOICE",
];

const STORE_FILE: &str = "byok.json";

#[tauri::command]
fn get_server_port(state: State<'_, ServerState>) -> Option<u16> {
    *state.port.lock().unwrap()
}

// Read BYOK keys from the store and return as (k, v) pairs ready to inject
// into a sidecar Command. Empty / whitespace-only values are skipped so an
// "I haven't set this yet" entry doesn't blank out a real env var.
fn collect_byok_env(app: &AppHandle) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let Ok(store) = app.store(STORE_FILE) else { return out };
    for key in BYOK_KEYS {
        if let Some(val) = store.get(*key) {
            if let Some(s) = val.as_str() {
                let s = s.trim().to_string();
                if !s.is_empty() {
                    out.push((key.to_string(), s));
                }
            }
        }
    }
    out
}

// Frontend writes one key at a time, then calls apply_api_keys to bounce
// the sidecar. Persisting per-key avoids losing other keys if the user
// only updates one.
#[tauri::command]
fn save_api_key(app: AppHandle, provider: String, value: String) -> Result<(), String> {
    if !BYOK_KEYS.contains(&provider.as_str()) {
        return Err(format!("unknown provider key: {}", provider));
    }
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(provider, serde_json::Value::String(value));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

// Read the current value of a key (or empty string). Frontend uses this to
// pre-populate the BYOK input fields.
#[tauri::command]
fn get_api_key(app: AppHandle, provider: String) -> String {
    let Ok(store) = app.store(STORE_FILE) else { return String::new() };
    store
        .get(&provider)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default()
}

// Kill the current sidecar and spawn a new one with the latest BYOK env
// applied. Frontend calls this after save_api_key so the change takes
// effect without the user restarting the app.
#[tauri::command]
fn apply_api_keys(app: AppHandle, state: State<'_, ServerState>) -> Result<(), String> {
    // Take ownership of the existing child so dropping it doesn't fight with
    // the Mutex held while we respawn.
    let old = state.child.lock().unwrap().take();
    if let Some(child) = old {
        let _ = child.kill();
    }
    *state.port.lock().unwrap() = None;
    spawn_sidecar(app);
    Ok(())
}

// DEV ONLY: read server/.env so the sidecar gets API keys without the user
// needing to source it manually. In release builds this returns empty and
// keys come exclusively from the BYOK store.
fn load_dev_env_vars() -> Vec<(String, String)> {
    let mut vars = Vec::new();
    if !cfg!(debug_assertions) {
        return vars;
    }
    let candidates = [
        std::path::PathBuf::from("server/.env"),
        std::path::PathBuf::from("../server/.env"),
    ];
    let env_path = candidates.into_iter().find(|p| p.exists());
    let Some(path) = env_path else {
        log::warn!("[shell] dev: server/.env not found");
        return vars;
    };
    let Ok(content) = std::fs::read_to_string(&path) else { return vars };
    for raw in content.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((k, v)) = line.split_once('=') else { continue };
        let key = k.trim().to_string();
        let val = v
            .trim()
            .trim_start_matches(['"', '\''])
            .trim_end_matches(['"', '\''])
            .to_string();
        if !key.is_empty() {
            vars.push((key, val));
        }
    }
    log::info!(
        "[shell] dev: loaded {} env vars from {}",
        vars.len(),
        path.display()
    );
    vars
}

// Spawn (or respawn) the sidecar. Pulls per-user paths + BYOK keys + dev
// .env + the privileged shell-set vars (PORT=0 etc) and starts watching
// stdout for the KIMI_PORT line.
fn spawn_sidecar(app: AppHandle) {
    let app_data = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    let app_cache = app
        .path()
        .app_cache_dir()
        .expect("failed to resolve app cache dir");
    std::fs::create_dir_all(&app_data).ok();
    std::fs::create_dir_all(&app_cache).ok();

    let db_path = app_data.join("state.db");
    let cache_dir = app_cache.join("tts-cache");
    std::fs::create_dir_all(&cache_dir).ok();

    log::info!("[shell] KIMI_DB_PATH = {}", db_path.display());
    log::info!("[shell] KIMI_CACHE_DIR = {}", cache_dir.display());

    let mut sidecar = app
        .shell()
        .sidecar("kimi-server")
        .expect("kimi-server sidecar missing — did you run server/build.sh?");

    // Order matters: dev .env first (lowest precedence), then BYOK store
    // (overrides dev defaults so a user who set their own key wins), then
    // privileged shell-managed paths/port last.
    for (k, v) in load_dev_env_vars() {
        sidecar = sidecar.env(k, v);
    }
    for (k, v) in collect_byok_env(&app) {
        sidecar = sidecar.env(k, v);
    }
    // Resolve yt-dlp binary path. Tauri places sidecar binaries next to
    // the main app binary (in dev: src-tauri/target/debug/yt-dlp; in prod:
    // the app bundle's MacOS or Resources dir, depending on platform).
    // current_exe() points at the running Tauri app, so its parent dir
    // holds yt-dlp too. The Node sidecar reads YTDLP_PATH and spawns it
    // for YouTube audio URL extraction (server/music/adapters/yt.js).
    let ytdlp_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .map(|d| d.join(if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" }))
        .filter(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    if !ytdlp_path.is_empty() {
        log::info!("[shell] YTDLP_PATH = {}", ytdlp_path);
    } else {
        log::warn!("[shell] yt-dlp not found next to main binary — YT streaming will fail");
    }

    sidecar = sidecar
        .env("PORT", "0")
        .env("KIMI_DB_PATH", db_path.to_string_lossy().to_string())
        .env("KIMI_CACHE_DIR", cache_dir.to_string_lossy().to_string())
        .env("YTDLP_PATH", ytdlp_path);

    let (mut rx, child) = sidecar
        .spawn()
        .expect("failed to spawn kimi-server sidecar");

    let state: State<ServerState> = app.state();
    *state.child.lock().unwrap() = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    log::info!("[server] {}", line.trim_end());
                    if let Some(port_str) = line.trim().strip_prefix("KIMI_PORT=") {
                        if let Ok(port) = port_str.parse::<u16>() {
                            let s: State<ServerState> = app_handle.state();
                            *s.port.lock().unwrap() = Some(port);
                            let _ = app_handle.emit("server-ready", port);
                            log::info!("[shell] server-ready on port {}", port);
                        }
                    }
                }
                CommandEvent::Stderr(line_bytes) => {
                    log::warn!(
                        "[server-err] {}",
                        String::from_utf8_lossy(&line_bytes).trim_end()
                    );
                }
                CommandEvent::Terminated(payload) => {
                    log::error!("[server] terminated, code = {:?}", payload.code);
                }
                _ => {}
            }
        }
    });
}

// Toggle the main window visibility. Used by tray click + Cmd+Shift+H
// shortcut. If hidden, also raises focus.
fn toggle_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let visible = w.is_visible().unwrap_or(false);
        if visible {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

// Show / hide the pet window. Created lazily on first show so we don't pay
// the webview cost when the user never enters mini mode.
fn show_pet_window(app: &AppHandle) {
    // Calculate where pet should appear: at main window's current outer
    // position. The user expects pet to morph in-place from main, not jump
    // to the top-left corner of the screen. Fall back to (60, 60) only if
    // main has no position (shouldn't happen in normal flow).
    let main_pos = app.get_webview_window("main").and_then(|m| m.outer_position().ok());

    if let Some(w) = app.get_webview_window("pet") {
        if let Some(pos) = main_pos {
            let _ = w.set_position(pos);
        }
        let _ = w.show();
        let _ = w.set_focus();
        // The pet's viewMode persists in its Pinia store across show/hide
        // cycles. After the user clicked chevron-back-to-main last time, pet
        // is still at 'full' — which would render an empty pet shell with
        // no chevron + no MiniStatusBar. Push it back to the slimmest state
        // every time main pops it open so the UX is consistent.
        let _ = w.emit("pet-reset-view", ());
        return;
    }
    let url = WebviewUrl::App("index.html#/pet".into());
    // Pet mirrors the web PlayerCard footprint: 420px wide. TopPanel renders
    // ~150px tall (hidden mode); + MiniStatusBar adds ~120px (mini mode); the
    // expanded AI DJ terminal needs ~280px more, hence the 820px cap.
    let mut builder = WebviewWindowBuilder::new(app, "pet", url)
        .title("Kimi")
        .inner_size(420.0, 140.0)
        .min_inner_size(420.0, 120.0)
        .max_inner_size(520.0, 820.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true);
    if let Some(pos) = main_pos {
        builder = builder.position(pos.x as f64, pos.y as f64);
    } else {
        builder = builder.position(60.0, 60.0);
    }
    if let Err(e) = builder.build() {
        log::error!("[shell] failed to create pet window: {}", e);
    }
}

fn hide_pet_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("pet") {
        let _ = w.hide();
    }
}

#[tauri::command]
fn show_pet(app: AppHandle) {
    show_pet_window(&app);
}

#[tauri::command]
fn hide_pet(app: AppHandle) {
    hide_pet_window(&app);
}

#[tauri::command]
fn restore_main_window(app: AppHandle) {
    // Sync main to pet's current outer position so the morph reads as
    // "pet expands back into main right where it was sitting" rather than
    // a teleport. Pet may have been dragged anywhere since main was hidden.
    let pet_pos = app.get_webview_window("pet").and_then(|p| p.outer_position().ok());
    if let Some(w) = app.get_webview_window("main") {
        if let Some(pos) = pet_pos {
            let _ = w.set_position(pos);
        }
        let _ = w.show();
        let _ = w.set_focus();
        let _ = w.unminimize();
        // Tell main's frontend to flip viewMode back to 'full' so the
        // collapsed PlayerCard re-expands. Without this, the user clicks
        // the pet's chevron, sees main reappear still in hide mode, and
        // has to click the chevron in main too.
        let _ = w.emit("view-restore", ());
    }
    hide_pet_window(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(ServerState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Sidecar — fires off the spawn task and returns immediately.
            spawn_sidecar(app.handle().clone());

            // System tray. Click to toggle main window; menu has Show pet,
            // Hide pet, Quit.
            let menu = Menu::with_items(
                app,
                &[
                    &MenuItem::with_id(app, "show_main", "Show Main Window", true, None::<&str>)?,
                    &MenuItem::with_id(app, "show_pet", "Show Pet", true, None::<&str>)?,
                    &MenuItem::with_id(app, "hide_pet", "Hide Pet", true, None::<&str>)?,
                    &MenuItem::with_id(app, "quit", "Quit Kimi Radio", true, None::<&str>)?,
                ],
            )?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .show_menu_on_left_click(false)   // left click toggles, right click opens menu
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show_main" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "show_pet" => show_pet_window(app),
                    "hide_pet" => hide_pet_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_port,
            save_api_key,
            get_api_key,
            apply_api_keys,
            show_pet,
            hide_pet,
            restore_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
