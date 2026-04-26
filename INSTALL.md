# Kimi Radio — 安裝指南

個人 AI 電台，會根據你的時間 / 天氣 / 行事曆推薦音樂，還有 AI DJ 講解每首歌的背景故事。

---

## 1. 安裝（macOS）

下載 `Kimi Radio_0.1.0_aarch64.dmg`（Apple Silicon Mac M1/M2/M3/M4，~62MB）。

1. 雙擊 `.dmg` 開啟
2. 把 **Kimi Radio** 圖示拖到 **Applications** 資料夾
3. 第一次開啟：到 Applications，**右鍵點 Kimi Radio → Open**

> 這步很重要！直接雙擊會跳「無法驗證開發者」（因為 app 沒有 Apple 簽名）。
>
> 用「右鍵 → Open」，會多出 **Open** 按鈕，按它確認就行。
>
> 之後再開就直接雙擊正常啟動。

---

## 2. 設定 API Keys（BYOK — Bring Your Own Keys）

App 啟動後，看到 Landing 畫面**先別按 BEGIN**，先設定 API key：

1. 開啟 app，**直接退出**（左上紅色 ✕，或 ⌘+Q）—— 我們要先用 **設定** 介面填 key 才不會卡在無 key 狀態
2. 重開 app → 看到 Landing 畫面
3. 進主介面後，點右上角 **齒輪圖示** ⚙
4. 滾到 **API Keys** 區塊

### 必填（4 選 1）

至少填一個 LLM provider 才能跑：

| Provider | 申請連結 | 推薦度 |
|----------|---------|--------|
| **Kimi (Moonshot)** | [platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys) | ⭐⭐⭐ 註冊送 USD$15 額度，最便宜 |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | ⭐⭐ 要綁卡 |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com/settings/keys) | ⭐⭐ |
| MiniMax | [minimax.chat](https://api.minimax.chat) | ⭐ |

**只填一個就夠**。填好 → **Save Settings** → app 會自動重啟內部服務載入新 key。

### 可選

- **OpenWeather** ([openweathermap.org](https://openweathermap.org/api))：天氣感知推薦更準。沒填會用內建預設值。

### 不需要填

- **SoundCloud / YouTube**：app 內建處理，不用 key。
- **TTS DJ 配音**：用微軟 Edge TTS，免費免 key。

---

## 3. 第一次使用

1. 點 **BEGIN** → 進入 Welcome 問卷（只有第一次）
2. 填你喜歡的 genre / mood / artists（可全空跳過）
3. AI DJ 開始挑歌、生成監聽建議 → 開始播放

---

## 4. 主要功能

- **AI DJ 終端機**：右下 `[ AI DJ TERMINAL ]` 點 **OPEN**，跟 DJ 聊天 / 點歌（中英文都通，回覆統一英文）
  - 例：「給我推薦周杰倫」「play some Nujabes」「something chill for late night」
- **時段標籤**：右上 `MORNING / LUNCH / AFTERNOON / WIND DOWN / LATE NIGHT` 會根據時間自動切換，推薦歌跟著變
- **行事曆整合**：在 **Settings → Preferences → Calendar URLs** 貼 iCal 連結，AI 會避免在會議多的時段推太吵的歌
- **桌寵模式**：左上下拉箭頭 → 主視窗收起，浮動小窗永遠在最上層，可以拖
  - 小窗右上箭頭再展開回主視窗
- **Cmd+Q** 完全退出（系統托盤關不掉 background sidecar）

---

## 5. 已知問題 & 限制

- **首次點 chat 推薦的歌會 loading ~10 秒**：app 用 yt-dlp 抓 YouTube 音源，第一首要解 cipher。同一首歌之後就秒進。
- **某些冷門中文歌找不到 SoundCloud 來源**：會自動 fallback YouTube，但需要 yt-dlp 有空跑（並行歌單 prefetch 時可能 rate limit）。
- **TTS DJ 有時候 429**：Kimi 限流時會退到備援 LLM，可能延遲 2-3 秒。
- **macOS 升級後第一次開可能卡**：右鍵 → Open 一次重置權限即可。

---

## 6. 反饋 & 回報 bug

開 app 時遇到問題，請給我：

1. 哪一步出問題（截圖更好）
2. **Console log**：在 app 任何視窗右鍵 → **Inspect Element** → 上方 tab 切 **Console** → 截圖紅字
3. 你的 macOS 版本 + Mac 機型

回報管道：直接 Telegram / WhatsApp / 微信丟給我。

---

## 7. 解除安裝

完整清掉所有資料：

```bash
# 移除 app
rm -rf "/Applications/Kimi Radio.app"

# 清掉設定 / API keys / 歷史 DB
rm -rf "$HOME/Library/Application Support/com.matlin.kimiradio"

# 清掉 TTS 音訊 cache
rm -rf "$HOME/Library/Caches/com.matlin.kimiradio"
```

---

享受你的個人電台 🎧
