# Spec：後端 API 契約（v1）

- Base：後端 `http://127.0.0.1:8793`；前端經 Vite proxy 以 `/api` 前綴呼叫（`/api/v1/tts` → `/v1/tts`）。
- 錯誤一律 JSON：`{ "error": "<機器可讀代碼>", "detail": "<人類可讀說明>" }`。
- 所有回應與文案繁體中文。

### 並行規則（拍板 2026-10-15）

- 後端只有**一把鎖**，由「產生語音」與「載入 / 卸載模型」共用。持鎖期間 `busy = true`。
- **不排隊**：持鎖期間再來的 `/v1/tts`、`/v1/models/load`、`/v1/models/unload` 一律立即回 `409 busy`，不等待、不佇列。
- **查詢端點不受鎖影響**：`/v1/health`、`/v1/models` 任何時候都可讀，前端靠它們顯示「產生中 / 切換中」。
- `/v1/health` 另回 `busy_reason`：`"generating"`、`"loading"`、`"unloading"` 或 `null`，前端據此顯示文案。
- 前端責任：busy 時禁用產生與切換按鈕；收到 409 時顯示「後端忙碌中，請稍候」並重新輪詢 `/v1/health`。
- 連線中斷（串流與非串流皆同）：後端逐段取 `generate` 的結果，每段之間檢查 `request.is_disconnected()`，斷線就停止取段並釋放鎖。mlx-audio 的 generate 是同步產生器，無法在一片段生成到一半時打斷，所以**釋放鎖的時效是「當前這一片段生成完之後」**。後端內部一律以 `stream=True` 取段（片段約 0.3 秒音訊），非串流請求也是，因此中止延遲實際約 0.3 秒，上限不超過一個自動分段。這段期間 health 仍回 `busy=true`、`busy_reason=generating`，前端輪詢自然會等到它變 false。

## 1. 健康與狀態

### GET /v1/health

```json
{ "status": "ok", "mock": false, "loaded": "8bit", "busy": false, "busy_reason": null, "busy_target": null }
```

- `loaded`：目前載入的版本 id，或 `null`。
- `busy`：是否正在產生或切換模型。`busy_reason`：`generating` / `loading` / `unloading` / `null`。
- `busy_target`：`loading` 時為正在載入的版本 id，其餘 `null`。
- **切換期間 `loaded` 為 `null`**：載入新版本時一開始就先卸載舊版本並清掉 `loaded`。前端顯示「切換中」以 `busy_reason` 與 `busy_target` 為準，不要依賴 `loaded`。（拍板 2026-10-15）

## 2. 模型版本

### GET /v1/models

```json
[
  { "id": "4bit", "name": "4-bit（最省記憶體）", "available": true,  "loaded": false,
    "disk_gb": 22, "peak_memory_gb": 55, "active_memory_gb": 27,
    "defaults": { "temperature": 0.7, "top_p": 0.7, "top_k": 30 } },
  { "id": "8bit", "name": "8-bit（建議）",       "available": true,  "loaded": true,  "...": "..." },
  { "id": "bf16", "name": "bf16（原版品質）",     "available": false, "loaded": false, "...": "..." }
]
```

- `peak_memory_gb`：**行程峰值**（含產生中的 MLX 快取），4bit / 8bit / bf16 = 55 / 72 / 103；`active_memory_gb`：MLX active 峰值 27 / 45 / 76。前端顯示用前者。（2026-10-15 依 Phase 2 實測改）
- `available`：下載**完整**才為 true。每次查詢重新判定，不快取。規則（印工 2026-10-15 實查下載中資料夾後定）：
  - **C. 一票否決**：`<資料夾>/.cache/huggingface/download/` 底下有任何 `*.incomplete` → false。
  - **A. 有檔案清單**：hf 下載會在 `<資料夾>/.cache/huggingface/trees/<rev>.json` 留 repo 檔案清單與每檔 bytes。清單存在時，清單中每個檔都存在且大小相符才為 true。
  - **B. 無清單的後備**：`config.json`、`codec.safetensors`、`tokenizer.json` 皆存在，且 `model-*.safetensors` 至少一個、編號連續。
  - 背景：這些 MLX repo **沒有** `model.safetensors.index.json`，權重是 `model-00001…NN.safetensors`（8bit 10 個、4bit 6 個），檔名不含總數；`config.json` 在下載一開始就會到，只看它或只看資料夾存在會把下載中的版本誤判為可載入。
  - 未下載或下載中的版本前端顯示為不可選。
- MOCK 模式下三個版本都回 `available: true`。

### POST /v1/models/load

Request：`{ "id": "8bit" }`

Response 200：`{ "loaded": "8bit", "seconds": 38.2 }`

| 狀態碼 | error | 情境 |
|--------|-------|------|
| 400 | `unknown_model` | id 不在三個版本內 |
| 404 | `model_not_available` | 該版本尚未下載 |
| 409 | `busy` | 正在產生或切換中 |
| 422 | `invalid_request` | 缺 `id` 或格式錯誤 |
| 500 | `model_load_failed` | mlx-audio 載入拋例外，或切換時**卸載舊版本失敗**；兩種情況下舊版本都已不在記憶體、`loaded` 為 `null`、`busy` 回 false 可再載入，detail 說明是載入還是卸載階段 |

載入前先卸載目前版本。同 id 重複載入直接回 200 不重載。

### POST /v1/models/unload

Response 200：`{ "loaded": null }`。busy 時 409。

## 3. 產生語音

### POST /v1/tts　（multipart/form-data）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `text` | string | 是 | 已組好角色標籤與表演標籤的純文字（見 model-capabilities.md 第四節） |
| `ref_audio` | file，可重複 | 否 | 參考音檔 WAV；≤ 60 秒 |
| `ref_text` | string，可重複 | 與 ref_audio 等長 | 該段音檔的逐字稿，**不含**角色標籤 |
| `ref_speaker` | int，可重複 | 與 ref_audio 等長 | 該段音檔屬於幾號角色（0–15） |
| `temperature` | float | 否 | 預設依版本；範圍 0 ≤ t ≤ 2 |
| `top_p` | float | 否 | 預設依版本；範圍 0 < p ≤ 1 |
| `top_k` | int | 否 | 預設依版本；≥ 1 |
| `max_tokens` | int | 否 | 每段最大 frame 數，預設 1024；≥ 1 |
| `stream` | bool | 否 | 預設 false；只接受 `true` / `false` |

格式或範圍錯誤（如 `temperature=abc`、`top_p=0`、`stream=maybe`）回 `422 invalid_request`，detail 指出欄位與收到的值。

後端處理：`ref_text[i]` 前綴 `<|speaker:{ref_speaker[i]}|> ` 後交給 mlx-audio。

**非串流回應**：`200`，`Content-Type: audio/wav`，完整檔案。Header `X-Elapsed-Seconds`、`X-Audio-Seconds`、`X-Request-Id`、`X-Early-Stop`（`true` / `false`）、`X-Chunks`（自動分段數）。

**提前中斷偵測（拍板 2026-10-15）**：後端在取段迴圈中（不改第三方碼）偵測「已出聲後連續 **6 秒**低於 **−50 dBFS**」或「**開頭 6 秒內從未出聲**（無任何 100 ms 窗 > **−40 dBFS**）」即關閉產生器，**非串流**裁掉尾端靜音（保留最後有聲點之後 0.5 秒；開頭無聲規則觸發時沒有有聲點，只回開頭 0.5 秒），回 `200` 並標 `X-Early-Stop: true`；**串流**已送出的靜音收不回，偵測到即正常結束串流、不裁切，最多多送約 6 秒靜音。前端看到即提示「偵測到長時間無聲，已自動停止；若內容不完整請重新產生」，先前 take 列表短版「長時間無聲，已自動停止」。兩條規則（尾端靜音、開頭無聲）共用同一個布林與同一句文案，後端 log 記「規則=silence / onset」但不進契約；偵測分不出講一半就斷與講完不停。出聲門檻 −40 dBFS 依 61 個樣本定：正常檔開頭最安靜 −31.9（輕柔風格前綴開頭），失敗檔 −42 以下，−35 只剩 3 dB 餘裕、耳語開頭會誤判。閾值 2026-10-15 由 4 秒改 6 秒：第二批 12 檔正常句非尾端停頓已到 3.7 秒，中斷尾巴仍 ≥ 19 秒，6 秒留 13 秒餘裕；放 settings 可調。

**串流回應**：`200`，`Content-Type: audio/pcm`，chunked；raw s16le、mono、44100 Hz。
Header `X-Sample-Rate: 44100`、`X-Request-Id`。片段邊界無意義，前端持續餵入 Web Audio。串流無法在開頭標 `X-Early-Stop`，偵測到中斷時直接結束串流；前端於串流結束後查 `GET /v1/tts/last` 取得結果。

### GET /v1/tts/last

最近一次產生的結果（單人工具，鎖保證「最近一次」明確）：

```json
{ "request_id": "…", "early_stop": true, "audio_seconds": 3.2, "elapsed_seconds": 5.1, "chunks": 1 }
```

尚無任何產生時回 `404 no_generation_yet`。`chunks` 為自動分段數（後端 log 也記一行）。

- 記錄時機：每次回過 `200` 的產生結束時記，包含正常完成、提前中斷、串流中途斷線（此時 `early_stop: false`）；400 / 409 / 503 / 500 不記。
- `audio_seconds`：非串流為裁切後秒數；串流為實際送出的秒數。

| 狀態碼 | error | 情境 |
|--------|-------|------|
| 400 | `invalid_text` | 空字串、含結構 token、角色編號超出 0–15 或有前導 0；`ref_speaker` 非整數或超出 0–15；`ref_text` 空白或自帶角色標籤 |
| 400 | `reference_mismatch` | ref_audio / ref_text / ref_speaker 數量不一致 |
| 400 | `reference_too_long` | 參考音檔超過 60 秒 |
| 400 | `reference_decode_failed` | 音檔無法解碼 |
| 409 | `busy` | 另一產生或切換進行中；後端不排隊，前端禁用按鈕並輪詢 health |
| 503 | `no_model_loaded` | 尚未載入任何版本 |
| 422 | `invalid_request` | 取樣參數格式或範圍錯誤 |
| 500 | `generation_failed` | mlx-audio 拋例外，detail 帶訊息 |

**檢查順序**：先 400 / 422（純驗證，不需鎖），再 409（鎖），最後 503（模型）。所以載入中送 `/v1/tts` 得到 409 而非 503。

**串流的錯誤時機**：回 200 之前後端先跑完第一個片段（約 0.3 秒），第一片段的錯誤仍以 500 JSON 回；串流開始後的錯誤只能中止連線，前端以連線提前結束判定失敗並顯示「產生中斷」。

**不擋的情況**：WAV header 宣稱長度大於實際資料（被截斷的檔）照常接受，只解前段；mlx-audio 讀它不會失敗。

## 4. MOCK 模式

`MOCK=1` 啟動時：不 import mlx-audio；`/v1/tts` 回傳長度約等於字數 × 0.15 秒的合成音（每個角色不同音高的正弦波），串流時每 0.3 秒吐一段。
用途：模型未下載時開發前端。`/v1/health` 的 `mock: true` 讓前端顯示提示。
文字中含 `[mock:early-stop]` 時，MOCK 模擬提前中斷：出聲 1 秒後輸出約 −60 dBFS 的小雜訊（不是全零），讓真正的偵測規則自然觸發，約 7.3 秒結束（1 秒聲音 + 6 秒靜音），回 `X-Early-Stop: true` 與 `/v1/tts/last` 的 `early_stop: true`，供前端開發提示 UI。文字含 `[mock:silent]` 時模擬全程無聲（約 −60 dBFS 小雜訊），由開頭無聲規則在 6 秒觸發，非串流回開頭 0.5 秒。MOCK 的 `chunks` 依每 300 UTF-8 bytes 一段模擬。

## 5. 變更規則

契約變更 → 同步本檔、`user/http/*.http`、前端 `src/lib/api.js`，並在對應 Epic 文件記錄。
