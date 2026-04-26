# Kimi Radio 🎵

個人 AI 電台 —— 以 Kimi 為大腦，網易雲音樂為音源，Fish Audio 為語音，打造專屬於你的智能音樂伴侶。

UI 嚴格還原設計圖，支持明暗雙主題、AI DJ 播報、智能推薦、語音合成、節律調度。

![Player UI](design-reference.png)

## 系統架構

```
┌─────────────┐     WebSocket/HTTP     ┌──────────────┐
│   Vue PWA   │ ◄────────────────────► │  Node.js API │
│  (播放器)    │                        │   (中樞)      │
└─────────────┘                        └──────┬───────┘
                                              │
        ┌────────────┬────────────┬──────────┼──────────┐
        ▼            ▼            ▼          ▼          ▼
    Kimi API    Netease API   Fish Audio  OpenWeather  飛書
```

## 功能特性

- 🎨 **高精度 UI**：520×740px 播放器卡片，嚴格還原設計圖（明暗雙主題）
- 🧠 **AI DJ**：Kimi 大模型驅動，根據你的品味、時間、天氣推薦音樂
- 🎵 **網易雲音樂**：本地部署 NeteaseCloudMusicApi，獲取真實音源
- 🗣️ **語音播報**：Fish Audio TTS，AI DJ 開口說話
- 📅 **節律調度**：早間播報、小時情緒檢查、日程提醒
- 💬 **Archivist Terminal**：與 AI 助手對話，了解音樂背後的故事
- 📱 **PWA**：可安裝為桌面應用，離線緩存

## 快速開始

### 1. 安裝依賴

```bash
npm run install:all
```

### 2. 配置 API Key

複製 `.env.example` 為 `.env`，填入你的 API Key：

```bash
cp server/.env.example server/.env
```

| Key | 用途 | 申請地址 |
|-----|------|---------|
| `KIMI_API_KEY` | AI 大腦 | https://platform.moonshot.cn |
| `FISH_AUDIO_KEY` | TTS 語音 | https://fish.audio |
| `OPENWEATHER_KEY` | 天氣 | https://openweathermap.org/api |

### 3. 啟動網易雲音樂 API

```bash
git clone https://github.com/Binaryify/NeteaseCloudMusicApi.git
cd NeteaseCloudMusicApi
npm install
node app.js
# 服務運行在 http://localhost:3000
```

### 4. 啟動 Kimi Radio

```bash
npm run dev
```

這會同時啟動：
- 前端：`http://localhost:5173`
- 後端：`http://localhost:8080`
- WebSocket：`ws://localhost:8080/stream`

### 5. 打開瀏覽器

訪問 `http://localhost:5173`，享受你的個人 AI 電台！

## 文件結構

```
kimi-radio/
├── web/              # Vue 3 PWA 前端
│   ├── src/
│   │   ├── components/   # UI 組件（播放器、對話框、設置等）
│   │   ├── stores/       # Pinia 狀態管理
│   │   ├── composables/  # 可復用邏輯（主題、音頻、WS）
│   │   └── assets/       # 字體、圖片
│   └── tailwind.config.js # Design Token 配置
│
├── server/           # Node.js 中樞
│   ├── index.js          # Express + WebSocket 入口
│   ├── router.js         # API 路由
│   ├── kimi.js           # Kimi API 適配器
│   ├── ncm-client.js     # 網易雲客戶端
│   ├── scheduler.js      # 節律調度器
│   ├── context.js        # Context Window 組裝
│   ├── data/             # 用戶語料（taste.md, routines.md 等）
│   └── prompts/          # AI 人設提示詞
│
└── package.json      # 根項目腳本
```

## 用戶語料

在 `server/data/` 目錄下編輯你的個人資料：

- **taste.md** — 音樂品味描述
- **routines.md** — 日常作息偏好
- **playlists.json** — 喜愛歌單
- **mood-rules.md** — 情緒與音樂對應規則

AI 會根據這些資料為你量身定制推薦和播報。

## 設計規範

| Token | 數值 |
|-------|------|
| 主卡片尺寸 | 520 × 740 px |
| 圓角 | 24 px |
| 陰影 | 0 20px 40px rgba(0,0,0,0.08) |
| 主色 | #B0666D (玫瑰紅) |
| 淺色背景 | #F4EEF0 |
| 深色背景 | #0F0B0E |
| 字體 | Inter (正文) + VT323 (點陣時鐘) |

## 技術棧

- **前端**：Vue 3 + Vite + Tailwind CSS + Pinia
- **後端**：Express + WebSocket + SQLite
- **AI**：Kimi API (OpenAI 兼容)
- **音樂**：NeteaseCloudMusicApi
- **語音**：Fish Audio TTS

## License

MIT
