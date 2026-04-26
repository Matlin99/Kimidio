# Kimi Radio 🎵

**Your personal AI radio — desktop app edition.** A floating pet window on your screen with an AI DJ that picks tracks based on your time of day, weather, and calendar; speaks intros for each song; and chats back when you ask for recommendations.

> **⚠️ v0.1.0 — Preview Release**
> First public testing build. Expect rough edges. Bug reports welcome via [Issues](https://github.com/Matlin99/Kimidio/issues).

[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri)](https://tauri.app/)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-F9F1E1?logo=bun)](https://bun.sh/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-preview-orange.svg)]()

---

## English

### Highlights

- 🧠 **Multi-LLM AI DJ** — Kimi · OpenAI · Claude · MiniMax with automatic fallback
- 🎵 **Dual music sources** — SoundCloud streams primary; YouTube (via bundled `yt-dlp`) covers Mandopop / J-pop / cold-catalog tracks
- 🗣️ **Free TTS** — Microsoft Edge TTS (en-GB Sonia voice, no API key required)
- 💬 **AI DJ Terminal** — chat for recommendations, ask about a track's history (Chinese in / English out)
- 📅 **Time-block + calendar aware** — Morning / Lunch / Afternoon / Wind-down / Late-night blocks; iCal feeds bias picks toward instrumentals during meeting-heavy hours
- 🐾 **Pet window** — always-on-top floating mini view (420 px wide); drag anywhere; expand back to main window
- 🔐 **BYOK (Bring Your Own Keys)** — API keys stored encrypted on disk via `tauri-plugin-store`, never transmitted off-device
- 🎙️ **Voice input** — Web Speech API (Chromium browsers in dev mode)
- 🎼 **Musical Story** — LLM-generated liner notes and artist bios for every track
- 📦 **Single-file distribution** — Tauri 2 packages everything as a `.dmg`

### Install (for testers)

Download the latest `.dmg` from [Releases](https://github.com/Matlin99/Kimidio/releases), then follow the step-by-step in [`INSTALL.md`](./INSTALL.md).

You'll need to bring at least one LLM API key (Kimi recommended — free $15 credit on signup at [platform.moonshot.cn](https://platform.moonshot.cn)).

### Architecture

```
┌────────────────────────────────────────────────┐
│  Tauri 2 desktop shell (Rust)                  │
│  ├─ main window (Vue 3 PWA, 620×780)           │
│  ├─ pet window (always-on-top, 420×auto)       │
│  ├─ system tray                                │
│  └─ sidecar binaries:                          │
│      ├─ kimi-server (Bun-compiled, ~63 MB)     │
│      │    └─ Express + WS + bun:sqlite         │
│      └─ yt-dlp (~35 MB)                        │
└────────────────────────────────────────────────┘
        │
        ├─ LLM:    Kimi / OpenAI / Claude / MiniMax
        ├─ Music:  SoundCloud + YouTube (via yt-dlp)
        ├─ TTS:    Microsoft Edge TTS (no key)
        └─ Weather: OpenWeather (optional)
```

### Development

**Prerequisites:** macOS (Apple Silicon recommended), Node.js 20+, Rust (`rustup install stable`), Bun (`curl https://bun.sh/install | bash`).

```bash
# 1. Install dependencies
npm install
cd web && npm install
cd ../server && npm install
cd ..

# 2. Configure API keys for dev mode
cp server/.env.example server/.env
# Edit server/.env — fill at least one LLM key

# 3. Build sidecar binary
bash server/build.sh
cp server/dist/kimi-server-darwin-arm64 \
   src-tauri/binaries/kimi-server-aarch64-apple-darwin

# 4. Download yt-dlp binary
curl -L -o src-tauri/binaries/yt-dlp-aarch64-apple-darwin \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
chmod +x src-tauri/binaries/yt-dlp-aarch64-apple-darwin

# 5. Run dev mode
npm run tauri:dev

# 6. Build .dmg
npm run tauri:build
```

### Project Structure

```
kimi-radio/
├── web/                      Vue 3 + Vite frontend
│   ├── src/
│   │   ├── App.vue                   main window root
│   │   ├── PetApp.vue                pet window root (#/pet hash route)
│   │   ├── components/               PlayerCard / TopPanel / MiniStatusBar / ...
│   │   ├── stores/                   Pinia: player / chat / settings / schedule
│   │   └── composables/              useApiBase / useTTS / useBroadcastSync / ...
│   └── tailwind.config.js
│
├── server/                   Express + WebSocket + LLM hub (Node + Bun)
│   ├── index.js                      entry (dual runtime)
│   ├── router.js                     /api/* endpoints
│   ├── tts.js                        Edge TTS + atomic mp3 cache
│   ├── llm/providers/                kimi / openai / claude / minimax adapters
│   ├── music/adapters/               sc / yt / local
│   ├── calendar.js                   iCal fetch + per-block summary
│   ├── scheduler.js                  morning / hourly / evening cron
│   ├── context.js                    6-piece context-window assembler
│   └── build.sh                      bun --compile, 4 platforms
│
├── src-tauri/                Tauri 2 Rust shell
│   ├── src/lib.rs                    main + pet windows, tray, sidecar supervisor, BYOK store
│   ├── tauri.conf.json
│   └── binaries/                     not in git; produced by build.sh
│
├── INSTALL.md                end-user install guide
├── SELF_CHECK.md             feature audit checklist
└── package.json
```

### Persistence

| Storage | What |
|---------|------|
| `localStorage` | Theme, volume, shuffle/repeat, favorites, taste, preferences, LLM provider choice |
| `tauri-plugin-store` | BYOK API keys (encrypted `keys.json`) |
| SQLite (`state.db`) | Chat history, play history (used by curate to avoid repeats) |
| Disk cache | TTS mp3 files (atomic-rename + md5 key, persists across restarts) |
| In-memory | yt-dlp resolved URLs (5-hour TTL) |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + Vite + Tailwind CSS + Pinia |
| Desktop shell | Tauri 2 (Rust) |
| Backend | Express + WebSocket + bun:sqlite |
| Sidecar runtime | Bun (`bun build --compile`) |
| LLM | Kimi / OpenAI / Claude / MiniMax (with fallback chain) |
| Music | soundcloud.ts + ytmusic-api + yt-dlp |
| TTS | msedge-tts (en-GB Sonia) |

### Known Limitations

- **yt-dlp is used to fetch YouTube audio streams** — this technically violates YouTube's ToS. Personal / friend-testing use is fine; **commercial distribution carries legal risk**.
- **First click on a Mandopop / cold-catalog track waits ~10 s** while yt-dlp solves the YouTube cipher. Subsequent plays are cached.
- **macOS distribution is ad-hoc signed** (no $99 Apple Developer subscription). Friends need to right-click → Open the first time to bypass Gatekeeper.

### License

MIT — see [`LICENSE`](./LICENSE).

---

## 中文

### 簡介

桌面 AI 電台 app — 螢幕角落一個浮動小窗，AI DJ 根據時間、天氣、行事曆挑歌，每首開頭講個簡短背景，問就答；中文輸入英文回答。

### 功能特色

- 🧠 **多 LLM AI DJ** — Kimi / OpenAI / Claude / MiniMax 自選，自動 fallback
- 🎵 **雙音源** — SoundCloud 為主串流；YouTube（內建 `yt-dlp`）補位 Mandopop / J-pop / 冷門曲
- 🗣️ **免費 TTS** — Microsoft Edge TTS (en-GB Sonia 音色，免 API key)
- 💬 **AI DJ Terminal** — 聊天點歌 / 問曲背景；中英文都通，回覆統一英文
- 📅 **節律 + 行事曆感知** — 早晨 / 午餐 / 下午 / 下班 / 深夜時段自動切換；iCal 日程感知（會議多時偏向 instrumental，不打擾）
- 🐾 **桌寵模式** — always-on-top 浮動小窗（420 px 寬），任意拖、可展開回主窗
- 🔐 **BYOK** — API keys 加密存本地（`tauri-plugin-store`），絕不外傳
- 🎙️ **語音輸入** — Web Speech API（Chromium 瀏覽器 dev 模式可用）
- 🎼 **MusicalStory** — 每首歌 LLM 生成 liner notes 與藝人 bio
- 📦 **單檔分發** — Tauri 2 包成 `.dmg`，朋友拖一下就裝好

### 安裝（給朋友測試用）

到 [Releases](https://github.com/Matlin99/Kimidio/releases) 下載最新 `.dmg`，照著 [`INSTALL.md`](./INSTALL.md) 一步步走。

至少要準備一個 LLM API key（推薦 Kimi — [platform.moonshot.cn](https://platform.moonshot.cn) 註冊送 USD$15 額度）。

### 持久化儲存

| 位置 | 內容 |
|------|------|
| `localStorage` | 主題明暗、音量、shuffle/repeat、favorites、taste、preferences、LLM 選擇 |
| `tauri-plugin-store` | BYOK API keys（加密 `keys.json`） |
| SQLite (`state.db`) | 聊天歷史、播放歷史（curate 用來去重） |
| 磁碟 cache | TTS mp3（atomic rename + md5 key，跨重啟命中） |
| 記憶體 | yt-dlp 解析結果（5 小時 TTL） |

### 已知限制 / 法律提醒

- **yt-dlp 用於拿 YouTube audio stream** — 技術上違反 YouTube ToS。個人 / 朋友測試 OK，**商業分發要承擔法律風險**
- **冷門曲首次點要等 ~10 秒** — yt-dlp 解 YouTube cipher 用。同首歌之後秒進
- **macOS 只 ad-hoc 簽名**（沒花 $99 Apple Developer），朋友首次需右鍵 → Open 略過 Gatekeeper

### License

MIT — 詳見 [`LICENSE`](./LICENSE)。

---

## Roadmap (post-v0.1.0)

- [ ] Resume playback on app restart
- [ ] Linux / Windows builds
- [ ] Cross-device sync via cloud sync option
- [ ] Lyric source integration
- [ ] In-app updater

## Contributing

Bug reports and pull requests welcome via GitHub. For the testing-phase feedback channel, see [`INSTALL.md`](./INSTALL.md#6-反饋--回報-bug).

## Acknowledgments

- [Tauri](https://tauri.app/) — Rust desktop shell
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — YouTube extractor
- [Bun](https://bun.sh/) — JS runtime + bundler
- [msedge-tts](https://github.com/Migushthe2nd/MsEdgeTTS) — free Microsoft Edge TTS
- [ytmusic-api](https://github.com/zS1L3NT/ts-npm-ytmusic-api) — clean YT Music search
- [soundcloud.ts](https://github.com/Tenpi/soundcloud.ts) — SC API
