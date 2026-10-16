# drama-3 前端工作台

Fish Audio Drama 3 本機 TTS 工作台的前端：Vite + React 19、JavaScript、純 CSS、Oxlint。
角色（參考音檔）→ 劇本 → 產生與輸出，全部在本機，不連任何雲端服務；字型以 @fontsource 隨前端打包。

視覺規範：根目錄 [`DESIGN.md`](../DESIGN.md)（品牌層：紙張、窗光、凸版）與本目錄 [`DESIGN.md`](./DESIGN.md)（工作台層）。
API 契約：[`spec/api-conventions.md`](../spec/api-conventions.md)。

## 啟動

```bash
npm install
npm run dev                          # http://localhost:5173 ，/api/* 轉到 127.0.0.1:8793
DRAMA3_API_PORT=8794 npm run dev     # 後端跑在別的埠時用環境變數覆寫（例：另一隻 MOCK 後端）
```

- `/api/*` 經 Vite proxy 轉到 `http://127.0.0.1:${DRAMA3_API_PORT:-8793}`，並去掉 `/api` 前綴（`/api/v1/tts` → `/v1/tts`）。
- 後端要另外啟動：`bash server/run-server.sh`（模型未下載時 `MOCK=1 bash server/run-server.sh`；指定埠 `bash server/run-server.sh 8794`）。
- `npm run dev` 是長跑程序；背景執行請 `nohup npm run dev > /tmp/drama3-vite.log 2>&1 &`。

## 指令

| 指令 | 用途 |
|------|------|
| `npm run dev` | 開發伺服器（:5173，strictPort） |
| `npm run lint` | Oxlint |
| `npm run build` | 產出 `dist/` |
| `npm run preview` | 預覽 build 結果（不含 proxy 以外的設定差異） |

## 開發用 URL 參數

| 參數 | 作用 |
|------|------|
| `?theme=light` / `?theme=dark` / `?theme=auto` | 指定主題（也可在頁首切換；選擇記在 localStorage） |
| `?demo` | **只在 `npm run dev` 有效**：載入示範狀態（兩角色、三行劇本、兩張 take，音訊是前端合成的測試音），供截圖與版面檢查；production build 不含這段程式；`?demo=early` 讓最新 take 顯示「偵測到長時間無聲，已自動停止；若內容不完整請重新產生」提示 |
| `?tab=speakers` / `script` / `output` | 手機寬度（< 768px）的初始分頁 |

截圖存在 `screenshots/`（不進版控）。

## 目錄

```
src/
├── main.jsx                進入點；載入 @fontsource 字型
├── App.jsx / App.css       版面（三欄 / 兩欄 + 角色橫列 / 手機分頁）、頁首、MOCK 提示、送出前檢查
├── index.css               設計 token、紙張紋理（SVG 濾鏡 data URI）、暗色主題、基礎元件樣式
├── hooks/
│   ├── useStudio.js        reducer：角色、劇本行、原始模式、取樣參數、產生 / 串流 / 停止、take
│   ├── useBackend.js       輪詢 /v1/health（忙碌 1 秒、閒置 5 秒）、版本清單、載入 / 卸載
│   ├── useMediaQuery.js    版面斷點（wide / mid / narrow）
│   └── useTheme.js         主題切換
├── lib/
│   ├── api.js              後端呼叫；錯誤統一拋 ApiError { status, error, detail }
│   ├── messages.js         error 代碼 → 中文訊息
│   ├── script.js           劇本組字、原始文字轉回劇本行、結構 token 檢查、標籤插入、送出前檢查
│   ├── pcmPlayer.js        串流 s16le PCM → Web Audio 排程播放
│   ├── wav.js              任意音檔 → mono 16-bit WAV（保留原始取樣率）
│   ├── recorder.js         麥克風錄音（保留裝置取樣率）
│   ├── format.js / uid.js  顯示格式、暫用鍵
│   └── demo.js             開發用示範狀態（?demo）
└── components/             SpeakerPanel / SpeakerCard、ScriptEditor / TagToolbar、ModelSelector、
                            SamplingPanel、OutputPanel / TakeSheet、Player、Glyph（自繪傳輸字形）、Bits（小元件）
```
