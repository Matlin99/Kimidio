# Kimi Radio 功能自檢清單

版本：Tauri 2 桌面 app + BYOK 分發測試版
自檢日期：2026-04-26

每一項 ✓ = 程式碼路徑存在且檢查過、❓ = 需要 runtime 手動驗證、⚠ = 已知問題

---

## A. Boot Flow

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| A1 | App 啟動 → Vite + Tauri shell + sidecar 都起來 | ✓ | log 看到 `server-ready on port XXXX` |
| A2 | apiBase 抓到 sidecar port (不是 8080 fallback) | ✓ FIXED | 改用 `apiFetch` + 所有早期 fetch await `apiReady` |
| A3 | Greeting 載入（max 3.5s） | ✓ | App.vue:248 已 gate apiReady |
| A4 | Initial curate 載入 | ✓ FIXED | player.js:530 已 gate |
| A5 | Welcome questionnaire（首次） | ✓ | 條件渲染 |
| A6 | BootDiagnostic 動畫 + 顯示 today-context + 推薦曲目 | ✓ | BootDiagnostic.vue:86 已 gate |
| A7 | DJ Speaking Overlay + 預載的 monologue + TTS | ✓ FIXED | App.vue 預載 monologue + tts.preload |
| A8 | Main interface reveal | ✓ | mainInterfaceReady flag |

## B. Audio + Player

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| B1 | Play/Pause | ❓ | PlayerControls.vue |
| B2 | Next/Previous track | ❓ | player.js |
| B3 | Volume slider | ❓ | player.js setVolume |
| B4 | Shuffle | ❓ | toggleShuffle |
| B5 | Repeat mode | ❓ | toggleRepeat |
| B6 | Progress bar seek | ❓ | ProgressBar.vue |
| B7 | TTS ducking 主音樂 | ✓ | useTTS.js duckMusic |
| B8 | Auto next on track end | ✓ | player.js audio 'ended' handler |

## C. AI / LLM

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| C1 | Curate playlist | ✓ FIXED | apiReady gated |
| C2 | Greeting | ✓ FIXED | apiReady gated |
| C3 | DJ Monologue (6 beats) | ✓ FIXED | gated + preloaded |
| C4 | Track Story (liner notes) | ❓ | MusicalStory.vue:133 — 未 gate（runtime 後才呼叫，OK） |
| C5 | Chat with AI DJ | ✓ FIXED | apiReady gated + 30s timeout + JSON 強化 prompt |
| C6 | Recommendation 卡片渲染 | ✓ | structured.queue 渲染 in ArchivistChat + MiniStatusBar |
| C7 | English-only 強制 | ✓ FIXED | router.js:412 chat prompt 加 LANGUAGE 約束 |
| C8 | Provider fallback (kimi 429 → minimax) | ✓ | router.js tryOrder 邏輯 |

## D. TTS

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| D1 | Synthesize speech | ✓ | useTTS.js + server tts.js |
| D2 | Cache hit (instant replay) | ✓ FIXED | atomic rename + in-flight Map |
| D3 | Preload (cache warm-up) | ✓ FIXED | tts.preload + apiReady gated |
| D4 | Read button per chat msg | ✓ | ArchivistChat + MiniStatusBar |
| D5 | Stop currently speaking | ✓ | tts.stop() |

## E. Pet Window

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| E1 | Hidden mode (TopPanel only) | ✓ | PetApp.vue |
| E2 | Mini mode (+ MiniStatusBar) | ✓ | viewMode === 'mini' |
| E3 | Hide → mini transition (fade-slide) | ✓ FIXED | mini-reveal Vue Transition |
| E4 | OS window auto-fit content | ✓ FIXED | ResizeObserver + flex-shrink fix |
| E5 | Drag pet window | ✓ FIXED | mousedown → startDragging() |
| E6 | Position from main on show | ✓ FIXED | lib.rs reads main.outer_position |
| E7 | Restore main at pet position | ✓ FIXED | lib.rs reads pet.outer_position |
| E8 | Pet → main reset to slimmest view | ✓ | pet-reset-view event |
| E9 | Cover sync from main | ✓ | BroadcastChannel player snapshot |
| E10 | Chat sync between pet ↔ main | ✓ FIXED | DataCloneError fixed via JSON deep-clone |

## F. Always-on-top + System Tray

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| F1 | Pet always-on-top | ✓ | tauri.conf.json |
| F2 | Pet skip taskbar | ✓ | tauri.conf.json |
| F3 | System tray icon | ✓ | lib.rs setup |
| F4 | Tray click toggle main | ✓ | lib.rs |
| F5 | Tray menu (Show/Hide pet/Quit) | ✓ | lib.rs |

## G. Settings + BYOK

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| G1 | API Keys 5 fields (Kimi/OpenAI/Claude/MiniMax/OpenWeather) | ✓ | SettingsOverlay.vue |
| G2 | Save to tauri-plugin-store | ✓ | save_api_key Tauri command |
| G3 | Apply (kill + respawn sidecar with new env) | ✓ | apply_api_keys |
| G4 | Provider list refresh | ✓ FIXED | settings.fetchProviders gated |
| G5 | Taste preferences (genres/vibes/artists) | ✓ | settings store |
| G6 | Weather city setting | ✓ | settings.preferences |
| G7 | TTS toggle | ✓ | settings.preferences.ttsEnabled |
| G8 | Calendar URLs | ✓ | settings.preferences.calendarUrls |

## H. Schedule + Calendar

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| H1 | Time-block badge (MORNING/LUNCH/...) | ✓ | useTimeBlock |
| H2 | Block transition pulse cue | ✓ | TopPanel watch |
| H3 | iCal events fetch | ✓ FIXED | calendar.refresh gated |
| H4 | Schedule panel (per-block tracks) | ✓ | SchedulePanel.vue |
| H5 | Full-day batch curate | ✓ FIXED | schedule.curateFullDay gated |
| H6 | Calendar → curate context (busy minutes) | ✓ | router.js:153 |

## I. Other UI

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| I1 | Dark/Light theme toggle | ✓ | useTheme |
| I2 | Album cover crossfade | ✓ | TopPanel cover-swap transition |
| I3 | Dot-matrix clock | ✓ | TopPanel VT323 font |
| I4 | Real-time waveform | ✓ | TopPanel rAF |
| I5 | AlbumWidgets carousel | ✓ | App.vue main-reveal |
| I6 | TrackList | ✓ | TrackList.vue |
| I7 | MusicalStory (liner notes) | ✓ | MusicalStory.vue |
| I8 | LiveSection | ✓ | LiveSection.vue |
| I9 | Ambient soundtrack toggle | ✓ FIXED | useAmbient gated |

## J. Voice Input (Chrome/Edge only)

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| J1 | Mic icon (only if SpeechRecognition supported) | ✓ | speech.supported.value |
| J2 | Mic in ArchivistChat | ✓ | toggleVoiceInput |
| J3 | Mic in MiniStatusBar | ✓ | 加在 pet 後新加 |
| J4 | Tauri WebKit (no SpeechRecognition) → mic 隱藏 | ✓ | v-if="speech.supported.value" |

## K. WebSocket

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| K1 | WS connect to /stream | ✓ | useWebSocket.js |
| K2 | WS reconnect on sidecar respawn | ❓ | 需測試 |
| K3 | Live state stream | ✓ | broadcast in router.js |

## L. Distribution / Build

| # | 功能 | 狀態 | 備註 |
|---|------|------|------|
| L1 | Sidecar bun-compile (4 platforms) | ✓ | server/build.sh |
| L2 | Tauri build .dmg / .msi | ⚠ | 未做 — Day 4 task |
| L3 | INSTALL.md for friends | ⚠ | 未寫 — Day 4 task |

---

## 修復摘要 (this session)

1. **DataCloneError** — BroadcastChannel postMessage 結構化 clone 遇到 Vue reactive proxy 炸掉，導致整個 chat sync 死鎖。修：JSON deep-clone snapshots
2. **apiBase race** — 早期 fetch (curate / greeting / providers / calendar / ambient) 在 sidecar port 解析前就開打，全部走 8080 FALLBACK 死掉。修：所有早期 fetch await `apiReady` + 加 `apiFetch` wrapper 待後續 migrate
3. **isTauri 偵測脆弱** — 改成「無條件試 invoke，pure web 自然 fallback」
4. **TTS race** — preload + speak 並行 → 半成品 mp3。修：in-flight Map + atomic rename
5. **English-only chat** — router.js chat 加 LANGUAGE 約束
6. **JSON 強制** — chat prompt 強化要求歌單一律走 play[]
7. **Pet drag** — `mousedown → startDragging()` 取代失效的 `data-tauri-drag-region`
8. **Pet auto-fit height** — `flex-shrink: 0` + ResizeObserver
9. **Pet position follows main** — lib.rs show_pet/restore_main 互相讀對方 outer_position
