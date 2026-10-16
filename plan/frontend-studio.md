# Epic 2：前端工作台

> 角色、劇本、產生、播放、版本切換；先以 MOCK 後端開發

**狀態**：✅
**起訖**：2026-10-15 ~ 2026-10-15
**負責**：Rex × 對開（規劃）× 印工（實作）

---

## 設計決策

- JavaScript、純 CSS、無額外狀態套件。原因：與 whisper-cpp 一致；狀態用 `useReducer` 集中於一個 `useStudio` hook。
- 錄音與 WAV 編碼直接搬 whisper-cpp 的 `recorder.js` / `wav.js`，但目標取樣率改為保留原始取樣率（不降到 16k）。原因：Drama 3 參考音檔品質越高越好，降頻會損失音色。
- 劇本以「行」為單位：每行 = 角色 + 風格前綴（選填）+ 台詞 + 導演筆記（選填）。送出時由 `lib/script.js` 組成純文字。原因：使用者不必手打 `<|speaker:N|>`。
- 另提供「原始模式」文字框顯示組好的純文字，可直接編輯。原因：進階使用者與除錯。
- 串流播放用 Web Audio 排程 PCM；非串流用 `<audio>` 播 WAV Blob。原因：兩種回應格式不同。
- 版本切換是明確動作（按鈕 + 確認），不是每次產生自動切。原因：切換要卸載再載入，耗時數十秒。
- 參考音檔取樣率：Web Audio 解碼一律重取樣，改讀檔頭取得原始取樣率再編 WAV；ogg / webm 讀不到用 48 kHz。原因：保留音色細節。
- 刪除仍被劇本使用的角色：先確認，刪後該行顯示「（已刪除）」，產生時擋下並提示重新指定。原因：避免靜默丟行。
- 409「後端忙碌中」提示在 health 回 busy=false 時自動隱藏。
- 每個自動分段最多 3 個角色：前端無法精準重現後端分段，不擋，交給後端。
- 招牌字英文並列中文（SPEAKERS 角色 等），狀態與提示一律中文；MOCK 橫幅改「模擬後端」。依 frontend/DESIGN.md 2026-10-15 修正。
- 視覺依兩層 DESIGN.md：根目錄為品牌層（紙張、窗光、凸版），`frontend/DESIGN.md` 為工作台層（面板、元件、狀態）。衝突時材質與色值以根目錄為準、版面與元件以 frontend 為準。
- 不用顏色區分角色與狀態：角色用「角色章」（方形編號章），錯誤用校對紅筆 `error` 文字，狀態用 meta 文字。原因：品牌層無強調色。
- 字型以 @fontsource 套件自行打包（Lexend、Noto Sans TC、IBM Plex Mono），不連 Google Fonts。原因：離線可用是前提。

---

## 任務清單

### Phase 1：基礎與 API 層

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | `vite.config.js` 加 proxy：`/api` → `http://127.0.0.1:8793`，rewrite 去 `/api` | |
| ✅ | 安裝 `@fontsource/lexend`、`@fontsource/noto-sans-tc`、`@fontsource/ibm-plex-mono`，於 `main.jsx` 載入指定字重 | 離線可顯示 |
| ✅ | `src/index.css`：依兩層 DESIGN.md 建 CSS 變數（色票、字級、間距）、紙張紋理 SVG 濾鏡、暗色主題切換 | 紋理只套 body 與 take-sheet |
| ✅ | `src/lib/api.js`：health、models、load、unload、tts（非串流回 Blob、串流回 ReadableStream） | 錯誤統一拋 `{error, detail}` |
| ✅ | `src/lib/wav.js`、`src/lib/recorder.js` 自 whisper-cpp 搬入並調整取樣率 | |
| ✅ | `src/lib/script.js`：行 → 純文字組裝；標籤輔助；結構 token 檢查 | 對應 spec/model-capabilities.md 第四節 |
| ✅ | `src/lib/pcmPlayer.js`：s16le 串流 → AudioContext 排程播放 | |
| ✅ | `src/hooks/useStudio.js`：角色、劇本行、參數、版本、產生狀態的 reducer | |

### Phase 2：角色面板

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | `SpeakerPanel`：新增 / 刪除角色（最多 16），自動配 0–15 編號；`SpeakerStamp` 方形編號章 | 不用顏色區分 |
| ✅ | `SpeakerCard`：每角色多段參考音檔（dropzone 上傳或錄音）+ 逐字稿；顯示秒數，超 60 秒以 error-text 提示 | 能力 1、2、3；上傳已實測，錄音已實作但瀏覽器窗格無法授權麥克風、未實測 |
| ✅ | 參考音檔試聽 | |

### Phase 3：劇本編輯器

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | `ScriptEditor`：行列表，每行角色下拉 + 台詞；新增 / 刪除 / 上下移動 | 能力 5 |
| ✅ | 每行展開：風格前綴欄、導演筆記欄 | 能力 10、11 |
| ✅ | `TagToolbar`：點狀標籤與區間標籤快捷插入到游標處 | 能力 8、9 |
| ✅ | 原始模式切換：顯示 / 編輯組好的純文字 | |

### Phase 4：產生與輸出

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | `ModelSelector`：列三版本，未下載者不可選；切換按鈕與「切換中」狀態；MOCK 提示 | |
| ✅ | `SamplingPanel`：temperature / top_p / top_k / max_tokens；版本切換時換預設，使用者改過則保留 | 能力 19 |
| ✅ | 產生按鈕：串流開關；busy 時禁用 | 能力 18 |
| ✅ | `OutputPanel`：最新 take 以 `TakeSheet` 卡紙呈現（落紙動畫、窗光只在此面板）；播放器、下載 WAV、耗時與音訊長度、重新產生 | 唯一有陰影的物件 |
| ✅ | 傳輸字形（播放 / 停止 / 錄音 / 上下箭頭）以 inline SVG 自繪，1.5px 方頭 | 不引入圖示庫 |
| ✅ | 錯誤顯示：依 error 代碼轉成中文訊息 | |
| ✅ | 提前中斷提示：非串流讀 `X-Early-Stop`，串流結束後查 `/v1/tts/last`；take 顯示提示，meta 顯示分段數 | 2026-10-15 印工驗過；文案待 Phase 4b 更新 |
| ✅ | busy 處理：輪詢 `/v1/health`（產生中每 1 秒、閒置每 5 秒），busy 時禁用產生與切換；收到 409 顯示「後端忙碌中」 | 後端不排隊 |

### Phase 4b：設計修正（依 2026-10-15 拍板）

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | 暗色主題：卡紙 over-pass 窗光降到 30%，按鈕列 / 播放器 / 角色章 z-index 高於窗光 | 亮色不動；卡紙旋轉自成疊放層，改由卡紙自畫 30% 窗光（見踩雷）；截圖 dark-1440-early-stop-fixed.png |
| ✅ | MOCK 橫幅改中文：標籤「模擬後端」，文字「目前接的是模擬後端，產生的是測試音，不是模型推理結果」 | |
| ✅ | 提示文案改為「偵測到尾端長靜音，已自動停止；若內容不完整請重新產生」 | 兩處：take 卡紙用全文，先前的 take 列表用短版「尾端長靜音，已自動停止」 |
| ✅ | 刪除 Vite 模板殘留：`src/assets/hero.png`、`src/assets/react.svg`、`src/assets/vite.svg`、`public/icons.svg` | 對開已確認四檔無引用，授權刪除；移至印工 scratchpad 的 removed-assets/ 可復原 |
| ✅ | 對照 frontend/DESIGN.md 新文字：壓痕只套 title、暗色 sheen .06、中寬版欄寬、卡紙上按鈕透明底、播放器無滑塊 hover 刻度 | 補做 hover 1px×8px 刻度；其餘已符合 |

### Phase 5：驗證

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | MOCK 後端下：兩角色各一段參考音檔 + 三行劇本 → 串流與非串流皆可播放 | 開瀏覽器實測並截圖 |
| ✅ | 亮 / 暗主題與三種視口寬度（≥1280、768–1279、<768）各截圖一張對照 DESIGN.md | |
| ✅ | `npx @google/design.md lint` 對兩份 DESIGN.md 皆 0 錯誤 | |
| ✅ | `npm run lint`、`npm run build` 通過 | 分開跑 |

---

## 驗收標準

- [x] 使用者全程不需手打任何 `<|speaker:N|>`
- [x] 原始模式顯示的純文字與 spec 第四節語法一致
- [x] 版本切換期間無法按產生；切換完成後取樣參數預設更新
- [x] 串流播放首音在收到第一段後立即出聲
- [x] 所有文案繁體中文（2026-10-15 拍板：面板標題英中並列；TAKE、REC 為錄音室術語例外；MOCK 橫幅改「模擬後端」）
- [x] 畫面上沒有任何顏色區分、圓角、圓點、圖示庫；只有 take-sheet 有陰影

---

## 踩雷紀錄

- **m4a 取樣率讀錯**
  - 症狀：22.05 kHz 的 m4a 被判讀成 24 kHz。
  - 根因：用 MP3 同步字全檔掃描，在 MP4 容器裡誤判。
  - 解法：MP3 只檢查檔首或 ID3 之後的位置；M4A 讀 mp4a box 位移 +32 的取樣率。
- **區間標籤插入後游標跑到結尾**
  - 症狀：插入 `<whisper></whisper>` 後接著打的字跑到結束標籤後面。
  - 根因：受控 textarea 重設 value 後游標移到尾端，requestAnimationFrame 還原不可靠。
  - 解法：改用 useLayoutEffect，依暫存的選取範圍還原游標。
- **headless Chrome 截 390 寬被裁切**
  - 症狀：`--window-size=390,…` 截出的圖右側被裁掉。
  - 根因：headless 視窗有最小寬度，實際排版比 390 寬。
  - 解法：走 CDP 用 `Emulation.setDeviceMetricsOverride` 設寬度後截整頁。
- **oxlint 報 set-state-in-effect**
  - 症狀：`react(set-state-in-effect)` 警告。
  - 根因：在 effect 裡同步 setState 決定預選版本。
  - 解法：改在 render 時推導「使用者挑的 > 已載入的 > 建議的 8bit」。
- **串流請求在瀏覽器工具裡顯示失敗**
  - 症狀：串流 fetch 被列為 `200 OK [FAILED: net::ERR_ABORTED]`。
  - 根因：工具顯示問題；後端 log 正常完成、take 長度完整。
  - 解法：串流成敗以後端 log 與 take 長度為準。
- **卡紙上的元件 z-index 蓋不過窗光**
  - 症狀：卡紙上的按鈕怎麼調 z-index 都在外層窗光之下。
  - 根因：卡紙有 rotate，自成疊放層，子元素疊不出去。
  - 解法：暗色外層窗光降到卡紙之下只照地面，卡紙自畫一道 30% 窗光（對齊外層範圍、裁掉超出部分），按鈕列等疊在其上。
- **字串替換改壞 CSS**
  - 症狀：劇本行下方分隔線消失，並多出重複的 container query。
  - 根因：替換目標 `.script-foot {` 在檔案裡出現兩次，兩處都被改。
  - 解法：還原選擇器、刪除重複段；替換前先確認目標字串只出現一次。
