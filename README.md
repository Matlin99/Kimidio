# Kimi Radio 🎵

個人 AI 電台桌面 app — 你的時間、天氣、行事曆驅動 AI DJ 挑歌、講解、播報，永遠在桌面右上角的小窗。

---

## 功能特色

- 🧠 **多 LLM AI DJ**：Kimi / OpenAI / Claude / MiniMax 自選，自動 fallback
- 🎵 **SoundCloud + YouTube 雙音源**：SC 直接串流，冷門 / Mandopop / J-pop 用 yt-dlp 抓 YT 音軌補位
- 🗣️ **TTS 開場 + 點播朗讀**：Microsoft Edge TTS（en-GB Sonia / 免 key）
- 💬 **AI DJ Terminal**：聊天 / 點歌 / 問曲背景，中英文都通，回覆統一英文
- 📅 **節律 + 行事曆感知**：早晨 / 午餐 / 下班 / 晚間 / late-night 自動切時段；iCal 日程感知（會議多時偏向 instrumental）
- 🐾 **桌寵模式**：always-on-top 小窗，可拖、可展開回主窗
- 🔐 **BYOK**：API keys 加密存本地，不外傳
- 🎙️ **Voice input**：Web Speech API（Chrome/Edge dev 模式可用）
- 🎼 **MusicalStory**：每首歌 LLM 生成 liner notes + 藝人 bio
- 📦 **單檔分發**：Tauri 2 包成 `.dmg`，朋友拖一下就裝好

---

## 系統架構

```
┌────────────────────────────────────────────────┐
│  Tauri 2 desktop shell (Rust)                  │
│  ├─ main window (Vue 3 PWA)                    │
│  ├─ pet window (always-on-top, 420×auto)       │
│  ├─ system tray                                │
│  └─ sidecar binaries:                          │
│      ├─ kimi-server (Bun-compiled, ~63MB)      │
│      │    └─ Express + WS + bun:sqlite         │
│      └─ yt-dlp (~35MB)                         │
└────────────────────────────────────────────────┘
        │
        ├─ LLM: Kimi / OpenAI / Claude / MiniMax
        ├─ Music: SoundCloud (主) + YouTube via yt-dlp (fallback)
        ├─ TTS: Microsoft Edge TTS (免 key)
        └─ Weather: OpenWeather (optional)
```

---

## 安裝（給朋友測試）

下載最新 .dmg → 看 [INSTALL.md](./INSTALL.md) 一步步。

---

## 開發

### 前置需求

- macOS (Apple Silicon 推薦)
- Node.js 20+
- Rust (`rustup install stable`)
- Bun (`curl https://bun.sh/install | bash`)

### 1. 安裝依賴

```bash
npm install
cd web && npm install
cd ../server && npm install
```

### 2. 配置 API keys（dev mode）

```bash
cp server/.env.example server/.env
# 編輯 server/.env，至少填一個 LLM key
```

| Key | 用途 | 申請 |
|-----|------|------|
| `KIMI_API_KEY` | LLM | [platform.moonshot.cn](https://platform.moonshot.cn) |
| `OPENAI_API_KEY` | LLM | [platform.openai.com](https://platform.openai.com) |
| `CLAUDE_API_KEY` | LLM | [console.anthropic.com](https://console.anthropic.com) |
| `MINIMAX_API_KEY` | LLM | [minimax.chat](https://api.minimax.chat) |
| `OPENWEATHER_KEY` | 天氣（選） | [openweathermap.org/api](https://openweathermap.org/api) |

### 3. 編譯 sidecar binary

```bash
bash server/build.sh
# 產出 server/dist/kimi-server-{darwin-arm64,darwin-x64,windows-x64,linux-x64}
# 複製到 Tauri 的 binaries 路徑
cp server/dist/kimi-server-darwin-arm64 src-tauri/binaries/kimi-server-aarch64-apple-darwin
```

### 4. 下載 yt-dlp binary

```bash
curl -L -o src-tauri/binaries/yt-dlp-aarch64-apple-darwin \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
chmod +x src-tauri/binaries/yt-dlp-aarch64-apple-darwin
```

### 5. 啟動

```bash
npm run tauri:dev
```

Vite 跑在 5173、Tauri 主窗自動開、sidecar 由 Tauri 啟動（隨機 port）。

### 6. 打包 .dmg

```bash
npm run tauri:build
# 產出 src-tauri/target/release/bundle/dmg/Kimi Radio_<version>_aarch64.dmg
```

---

## 文件結構

```
kimi-radio/
├── web/                 # Vue 3 + Vite 前端
│   ├── src/
│   │   ├── App.vue              # 主窗 root
│   │   ├── PetApp.vue           # pet 窗 root（hash route #/pet）
│   │   ├── components/          # PlayerCard / TopPanel / MiniStatusBar / ArchivistChat / ...
│   │   ├── stores/              # Pinia: player, chat, settings, schedule, calendar
│   │   └── composables/         # useApiBase, useTTS, useBroadcastSync, useTheme, ...
│   └── tailwind.config.js
│
├── server/              # Express + WS + LLM hub
│   ├── index.js                 # 入口（Bun + Node 雙 runtime）
│   ├── router.js                # /api/* endpoints
│   ├── tts.js                   # Edge TTS 合成 + atomic cache
│   ├── llm/providers/           # kimi / openai / claude / minimax adapters
│   ├── music/adapters/          # sc / yt / local
│   ├── calendar.js              # iCal fetch + per-block summary
│   ├── scheduler.js             # 早晨 / 小時 / 晚間 cron
│   ├── context.js               # 6-piece context window assembler
│   └── build.sh                 # bun --compile 4 平台 binary
│
├── src-tauri/           # Tauri 2 Rust shell
│   ├── src/lib.rs               # main / pet 窗 + tray + sidecar 監督 + BYOK
│   ├── tauri.conf.json
│   └── binaries/                # 不入 git；build script 產出
│
├── INSTALL.md           # 朋友測試安裝說明
├── SELF_CHECK.md        # 功能 audit checklist
└── package.json
```

---

## 用戶語料

`server/data/` 編輯你的個人資料 — AI 推薦時會參考：

- **taste.md** — 音樂品味描述
- **routines.md** — 日常作息偏好
- **playlists.json** — 喜愛歌單
- **mood-rules.md** — 情緒與音樂對應規則

> 注意：行事曆事件**只送計數 + busy minutes 給 LLM**，事件標題 / 內容絕不外傳（隱私設計）。

---

## 持久化

- **localStorage**：theme / volume / shuffle / repeat / favorites / taste / preferences / provider 選擇
- **tauri-plugin-store**：BYOK API keys（加密 keys.json）
- **SQLite (`state.db`)**：chat history、play history（給 LLM 做 dedup）
- **磁碟 cache**：TTS mp3（atomic rename + md5 key，跨啟動命中）
- **記憶體 cache**：yt-dlp 解析結果（5h TTL）

---

## 技術棧

| 層 | 技術 |
|----|------|
| Frontend | Vue 3 + Vite + Tailwind + Pinia |
| Desktop shell | Tauri 2 (Rust) |
| Backend | Express + WebSocket + bun:sqlite |
| Sidecar runtime | Bun（`bun build --compile`） |
| LLM | Kimi / OpenAI / Claude / MiniMax (fallback chain) |
| Music | soundcloud.ts + ytmusic-api + yt-dlp |
| TTS | msedge-tts (en-GB Sonia) |

---

## 已知限制 / 法律提醒

- **yt-dlp 用於拿 YouTube audio stream** — 違反 YouTube ToS。個人 / 朋友測試 OK，**商業分發要承擔法律風險**
- **Mandopop / J-pop** SoundCloud 沒貨時走 YT，第一次點要等 ~10s（yt-dlp 解 cipher）
- **macOS distribution** 只 ad-hoc 簽名（沒花 $99 Apple Developer），朋友右鍵 → Open 略過 Gatekeeper

---

## License

MIT
