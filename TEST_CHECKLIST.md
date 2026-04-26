# Kimi Radio 完整測試清單

## 一、前端 UI 測試

### 1.1 PlayerCard 收起 / 展開
| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 1.1.1 | 收起動畫 | 點擊 HIDE 按鈕 | 下方內容 `grid-template-rows: 1fr → 0fr` + `opacity: 100 → 0`，TopPanel 始終可見 |
| 1.1.2 | 展開動畫 | 點擊 HIDE 再次（或點展開按鈕） | 下方內容平滑展開，ease-out-expo 曲線 |
| 1.1.3 | 展開按鈕脈衝 | 收起狀態下觀察右上角 | 展開按鈕有 `animate-pulse-dot` 綠點呼吸效果 |
| 1.1.4 | 雙重過渡 | 快速連點 HIDE | 動畫不卡頓、不閃爍，狀態正確切換 |

### 1.2 TopPanel
| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 1.2.1 | 封面顯示 | 載入頁面 | 左側顯示 80×80 封面，圓角 `rounded-lg` |
| 1.2.2 | 封面 Hover | 鼠標移到封面 | `scale-110` 放大 + 半透明遮罩 + 用戶圖標淡入 |
| 1.2.3 | 點陣時鐘 | 觀察 10 秒 | VT323 字體，`HH:MM` 格式，每秒更新 |
| 1.2.4 | 波形條（播放中） | 點擊播放 | 16 條音浪實時起伏，多頻率正弦波疊加，高度&透明度聯動 |
| 1.2.5 | 波形條（暫停） | 點擊暫停 | 音浪緩慢衰減回基礎高度，不是瞬間靜止 |
| 1.2.6 | 波形條（切歌） | 切到下一首 | 波形相位重置，產生新鮮擾動 |
| 1.2.7 | 底部對齊 | 肉眼檢查 | INTERLUDE 文字底部與音浪條底部平齊 |
| 1.2.8 | 設置按鈕 | 點擊齒輪圖標 | SettingsOverlay 彈出，backdrop-blur 背景 |
| 1.2.9 | 日期顯示 | 觀察底部 | 格式：`Sunday Apr 22 APR`，居中對齊 |
| 1.2.10 | DK / LT 切換 | 點擊 DK / LT | 主題切換，當前激活項顯示 `text-primary-rose` + `font-semibold` |

### 1.3 PlayerControls
| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 1.3.1 | 歌名顯示 | 觀察左側 | 顯示當前歌名（去括號），14px 字體，截斊處理 |
| 1.3.2 | 歌手顯示 | 觀察歌名下方 | 9px 大寫 tracking-[0.3em]，顯示 `{{ currentTrack.artist }}` |
| 1.3.3 | 膠囊按鈕 | 觀察中間左側 | ← → 兩個 28px 圓形按鈕，細邊框膠囊包裹，gap 適中 |
| 1.3.4 | 播放鍵居中 | 肉眼檢查 | 獨立圓形播放鍵在整個 420px 寬度中水平居中 |
| 1.3.5 | 播放狀態 | 點擊播放 | 圓形鍵變 `bg-primary-rose` + 白色陰影，圖標切換為暫停 |
| 1.3.6 | 暫停狀態 | 點擊暫停 | 圓形鍵變半透明邊框，圖標切換為播放，帶 `icon-flip` 過渡 |
| 1.3.7 | 上一首 / 下一首 | 點擊 ← / → | 切換歌曲，AlbumWidgets 同步滾動，波形相位重置 |
| 1.3.8 | HIDE 按鈕 | 點擊 HIDE | 播放器收起，文字變為 SHOW（收起狀態） |
| 1.3.9 | 音量顯示 | 觀察右側 | 顯示 `VLxx`（如 VL70），0-100 範圍 |
| 1.3.10 | 音量點擊 | 點擊音量條不同位置 | 音量跳轉到對應百分比，數字實時更新 |
| 1.3.11 | 音量拖拽 | 按住音量圓點左右拖動 | 音量平滑跟隨，鬆手後停止 |
| 1.3.12 | 響應式 | 改變窗口大小（如可調） | 所有元素不溢出、不換行 |

### 1.4 AlbumWidgets 垂直輪播
| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 1.4.1 | 當前封面 | 觀察中間 | 當前播放封面 160×160，scale 1.0，opacity 1，z-20 |
| 1.4.2 | 上下封面 | 觀察上下 | 相鄰封面 120×120，scale 0.85，opacity 0.5，z-10 |
| 1.4.3 | 拖拽跟隨 | 按住封面上下拖 | 實時跟隨鼠標/手指，無延遲，`duration-[0ms]` |
| 1.4.4 | Snap 切歌 | 拖拽超過閾值後鬆手 | 動畫過渡到最近 slot，跨越幾格就跳幾首歌 |
| 1.4.5 | Snap 回彈 | 拖拽未超過閾值後鬆手 | 回彈到原位置，不切歌 |
| 1.4.6 | 滾輪切歌 | 在輪播區滾動滑輪 | 每累積 30px 切一首歌，150ms 防抖 |
| 1.4.7 | 點擊播放 | 點擊非當前封面 | 切換到該歌曲，輪播位置同步更新 |
| 1.4.8 | 播放指示器 | 觀察當前封面 | 播放時指示器同步閃爍，暫停時靜止 |

---

## 二、AI DJ 功能測試

### 2.1 ArchivistChat
| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 2.1.1 | 打開聊天 | 點擊 LiveSection「AI DJ Terminal」或設置入口 | 聊天面板從底部 `slide-up` 彈入，backdrop 變暗 |
| 2.1.2 | 初始狀態 | 首次打開 | 顯示 `"` 大引號 + `Say something to the DJ...` |
| 2.1.3 | 發送消息 | 輸入文字，點擊發送或 Enter | 用戶氣泡右側出現，輸入框清空，Loading 狀態顯示 |
| 2.1.4 | AI 回覆 | 等待回覆 | 助理氣泡左側出現，最新一條帶打字機效果 |
| 2.1.5 | 結構化推薦 | 發送「推薦一首歌」 | 回覆中出現歌曲卡片：封面 + 歌名 + `Tap to play` + 播放圖標 |
| 2.1.6 | 點擊推薦播放 | 點擊歌曲卡片 | 若歌單中有匹配項則切換；無則追加為新曲目並播放 |
| 2.1.7 | 多輪對話 | 連續發送 3-5 條 | history 正確傳遞，上下文連貫 |
| 2.1.8 | 錯誤處理 | 斷網或後端未啟動時發送 | 顯示紅色錯誤氣泡，`Sorry, I'm having trouble connecting...` |
| 2.1.9 | 自動滾底 | 消息超過可視區域 | 自動滾動到最新消息底部 |
| 2.1.10 | 關閉面板 | 點擊 × 或 backdrop | 面板 `slide-up` 退出，backdrop 淡出 |

### 2.2 SettingsOverlay
| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 2.2.1 | LLM Provider 顯示 | 打開 Settings | 三個按鈕：kimi / claude / openai，帶綠點/灰點狀態指示 |
| 2.2.2 | 已配置狀態 | 後端有 key 時 | 綠點 `bg-green-500`，可點擊選中，選中項高亮 |
| 2.2.3 | 未配置狀態 | 後端無 key 時 | 灰點 `bg-neutral-400`，按鈕禁用，`cursor-not-allowed` |
| 2.2.4 | 自動選擇 | 打開 Settings | 若當前 provider 未配置，自動切換到第一個可用 provider |
| 2.2.5 | API Key 輸入 | 輸入各項 key | 密碼框顯示，內容正確綁定到 store |
| 2.2.6 | Preferences | 修改 Weather City / NCM URL | 輸入框響應，數據正確存儲 |
| 2.2.7 | 保存關閉 | 點擊 Save Settings | 面板關閉，設置生效 |

---

## 三、後端 API 測試

### 3.1 基礎服務
| # | 測試項 | 請求 | 預期結果 |
|---|--------|------|----------|
| 3.1.1 | 服務啟動 | `node server/index.js` | 控制台輸出 `Kimi Radio server running on http://localhost:8080` |
| 3.1.2 | WebSocket | 連接 `ws://localhost:8080/stream` | 後端打印 `WS client connected` |
| 3.1.3 | CORS | 從前端 `localhost:5173` 發請求 | 無 CORS 錯誤，響應正常 |

### 3.2 LLM Provider API
| # | 測試項 | 請求 | 預期結果 |
|---|--------|------|----------|
| 3.2.1 | 獲取 Provider 列表 | `GET /api/providers` | 返回 `{ providers: [{name, configured, defaultModel}, ...] }` |
| 3.2.2 | Kimi 對話 | `POST /api/chat` `{message, provider:'kimi'}` | 正常返回 `{content, role, structured?, usage}` |
| 3.2.3 | Claude 對話 | `POST /api/chat` `{message, provider:'claude'}` | 格式正確轉換，返回文字內容 |
| 3.2.4 | OpenAI 對話 | `POST /api/chat` `{message, provider:'openai'}` | 正常返回內容 |
| 3.2.5 | 結構化推薦 | 發送「推薦歌」類提示 | `structured` 欄位解析出 `{say, play, reason}` |
| 3.2.6 | 未配置 Provider | 發送請求到無 key 的 provider | HTTP 500，`error: Provider xxx is not configured` |
| 3.2.7 | 自動 Fallback | `provider` 留空 | 使用默認 `kimi` |
| 3.2.8 | 歷史傳遞 | `history` 帶多輪對話 | LLM 上下文連貫，history 正確附加到 messages |
| 3.2.9 | 消息存庫 | 發送對話後查庫 | `messages` 表有 user 和 assistant 兩條記錄 |
| 3.2.10 | context 組裝 | 觀察 `/api/chat` 調用 | `buildContext()` 正確組裝 6 片內容（persona + taste + routines + env + memory + trajectory） |

### 3.3 TTS
| # | 測試項 | 請求 | 預期結果 |
|---|--------|------|----------|
| 3.3.1 | TTS 生成 | `POST /api/tts` `{text:"hello"}` | 首次返回 `/tts-cache/{hash}.mp3`，耗時較長 |
| 3.3.2 | TTS 緩存 | 再次請求相同 text | 秒回，直接返回緩存 URL |
| 3.3.3 | 緩存文件 | 檢查 `server/tts-cache/` | 有 `.mp3` 文件生成 |
| 3.3.4 | 靜態訪問 | `GET /tts-cache/{hash}.mp3` | 瀏覽器可播放音頻 |
| 3.3.5 | 未配置 Key | 無 `FISH_AUDIO_KEY` 時請求 | HTTP 500，`Fish Audio API Key not configured` |

### 3.4 播放記錄
| # | 測試項 | 請求 | 預期結果 |
|---|--------|------|----------|
| 3.4.1 | 記錄播放 | `POST /api/play` `{track_id, track_title, track_artist, duration}` | 返回 `{success: true}`，`plays` 表新增記錄 |
| 3.4.2 | WS 廣播 | 發送 `/api/play` 時觀察 WS 客戶端 | 收到 `{type:'now-playing', track:{...}}` |
| 3.4.3 | 查詢當前 | `GET /api/now` | 返回最近一條播放記錄 |

### 3.5 其他 API
| # | 測試項 | 請求 | 預期結果 |
|---|--------|------|----------|
| 3.5.1 | Taste 數據 | `GET /api/taste` | 返回 `data/` 目錄下所有文件內容 |
| 3.5.2 | 今日計劃 | `GET /api/plan/today` | 返回當天日期 + 4 個時間段 schedule |
| 3.5.3 | 下一首建議 | `GET /api/next` | 返回 `{suggestions: []}`（當前為空實現） |

---

## 四、數據庫測試

| # | 測試項 | SQL / 操作 | 預期結果 |
|---|--------|-----------|----------|
| 4.1 | 表結構 | `.schema` | `messages`、`plays`、`prefs` 三張表存在，欄位正確 |
| 4.2 | messages 寫入 | 發送聊天後查詢 | `SELECT * FROM messages ORDER BY id DESC LIMIT 2` 有 user + assistant |
| 4.3 | plays 寫入 | 調用 `/api/play` 後查詢 | `SELECT * FROM plays` 有對應記錄，含 `played_at` 時間戳 |
| 4.4 | context 讀取 | `buildContext()` 調用 | `recentPlays` 正確讀取最近 5 條，`recentMessages` 最近 5 條 |
| 4.5 | 數據持久化 | 重啟後端後查詢 | 數據仍在，未丟失 |

---

## 五、WebSocket 測試

| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 5.1 | 連接建立 | 前端頁面載入 | 後端打印 `WS client connected` |
| 5.2 | 斷開連接 | 刷新頁面或關閉瀏覽器 | 後端打印 `WS client disconnected` |
| 5.3 | 聊天廣播 | 發送 `/api/chat` | 所有連接的 WS 客戶端收到 `{type:'chat', role:'assistant', content, structured}` |
| 5.4 | 播放廣播 | 發送 `/api/play` | 所有 WS 客戶端收到 `{type:'now-playing', track:{...}}` |
| 5.5 | 定時廣播 | 等待整點或手動改系統時間 | 收到 `{type:'scheduler', event, message}` |
| 5.6 | 多客戶端 | 開兩個瀏覽器標籤 | 兩個都收到相同廣播消息 |

---

## 六、定時任務 (Scheduler) 測試

| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 6.1 | 啟動日誌 | 啟動後端 | 打印 `[Scheduler] Started - tasks: 07:00 morning, hourly check, 18:00 evening` |
| 6.2 | 晨間問候 | 系統時間調到 07:00 | 觸發 `morning_greeting`，WS 廣播 `Good morning...` |
| 6.3 | 整點檢查 | 系統時間調到任意整點 | 觸發 `hourly_check`，WS 廣播 `How are you feeling?...` |
| 6.4 | 晚間放鬆 | 系統時間調到 18:00 | 觸發 `evening_wind_down`，WS 廣播 `Evening time...` |

---

## 七、異常 & 邊界測試

| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 7.1 | 後端未啟動 | 前端嘗試發送聊天 | 錯誤提示，`Sorry, I'm having trouble connecting...` |
| 7.2 | 空消息 | 不輸入文字直接發送 | 不發送，`!text.trim()` 攔截 |
| 7.3 | 快速切歌 | 連續快速點擊 ← → | 不崩潰，`slideDirection` 動畫鎖定 500ms |
| 7.4 | 音量邊界 | 拖拽到條外左側 / 右側 | `Math.max(0, Math.min(1, ...))` 限制在 0-100% |
| 7.5 | 拖拽干擾 | AlbumWidgets 拖拽時點擊 | 拖拽狀態下不觸發點擊播放，`!isDragging` 判斷 |
| 7.6 | 主題切換 | 反覆點擊 DK / LT | 主題正確切換，無閃爍，按鈕狀態正確更新 |
| 7.7 | 長歌名 | 播放超長歌名曲目 | 左側歌名截斊顯示，`truncate` 不撐破佈局 |
| 7.8 | 端口衝突 | 8080 被佔用時啟動 | Node 報 `EADDRINUSE`，需要手動終止舊進程 |

---

## 八、性能測試

| # | 測試項 | 步驟 | 預期結果 |
|---|--------|------|----------|
| 8.1 | 首次載入 | Lighthouse / DevTools | FCP < 1.5s，JS bundle ~124KB gzipped ~43KB |
| 8.2 | 波形性能 | 播放時觀察 Performance | RAF 不卡頓，幀率維持 60fps |
| 8.3 | 聊天延遲 | 發送消息到首字回覆 | 正常網絡下 < 3s（取決於 LLM） |
| 8.4 | 輪播拖拽 | 快速上下拖拽 | 無掉幀，`transform` GPU 加速 |
| 8.5 | 內存洩漏 | 播放 5 分鐘後觀察 Memory | 無明顯內存增長， RAF 正確清理 |

---

## 九、手動端到端測試流程

### 流程 A：完整播放體驗
1. 打開頁面 → 檢查封面、時鐘、波形、日期
2. 點擊播放 → 波形動起來，進度條開始走
3. 調整音量 → VL 數字變化，音量條滑動流暢
4. 拖拽 AlbumWidgets → 實時跟隨，鬆手 snap 切歌
5. 點擊 HIDE → 播放器收起，展開按鈕帶脈衝
6. 點擊 SHOW → 播放器展開，內容淡入
7. 切換主題 DK/LT → 顏色反轉，按鈕狀態更新

### 流程 B：AI DJ 完整對話
1. 點擊「AI DJ Terminal」→ 聊天面板彈出
2. 輸入「推薦一首適合晚上聽的歌」→ 發送
3. 等待 AI 回覆 → 觀察打字機效果
4. 若返回推薦卡片 → 點擊卡片播放
5. 檢查播放器 → 新歌曲開始播放，AlbumWidgets 更新
6. 連續對話 3 輪 → 上下文連貫
7. 打開 Settings → 檢查 Provider 狀態和綠點
8. 關閉面板 → 回到播放器

### 流程 C：後端連通性
1. 啟動後端 `node server/index.js`
2. 前端載入 → WS 連接成功
3. 發送 `/api/providers` → 返回可用 provider 列表
4. 發送 `/api/chat` → 返回 AI 回覆
5. 檢查 `state.db` → messages 表有記錄
6. 發送 `/api/tts` → 返回音頻 URL，可播放
7. 再次發送相同 TTS → 秒回（緩存命中）
8. 多開一個瀏覽器 → 兩個都收到 WS 廣播

---

## 測試環境建議

```bash
# 1. 啟動後端
cd server && node index.js

# 2. 啟動前端
cd web && npm run dev

# 3. 確保 .env 已配置（至少一個 LLM Key）
# KIMI_API_KEY=sk-...
# 可選：CLAUDE_API_KEY, OPENAI_API_KEY, FISH_AUDIO_KEY

# 4. 測試端口
# 前端: http://localhost:5173
# 後端: http://localhost:8080
# WebSocket: ws://localhost:8080/stream
```

---

*清單生成時間: 2026-04-22*
*對應版本: PlayerControls 最終版 + TopPanel JS 波形 + 完整 AI DJ 後端*
