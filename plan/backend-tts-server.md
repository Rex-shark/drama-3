# Epic 1：後端 TTS 服務

> FastAPI 薄封裝 mlx-audio，提供多角色參考音檔上傳、版本切換、串流與 MOCK 模式

**狀態**：✅
**起訖**：2026-10-15 ~ 2026-10-15
**負責**：Rex × 對開（規劃）× 印工（實作）

---

## 設計決策

- 自寫 FastAPI 而非用 mlx-audio 內建 server。原因：內建端點只收單一參考音檔且需伺服器端路徑，做不到多角色上傳。
- 只呼叫 mlx-audio 公開 API（`mlx_audio.tts.utils.load_model`、`model.generate`）。原因：專案禁止改第三方碼。
- mlx-audio 從 git 安裝並**鎖 commit**。原因：Drama 3 支援尚未進正式 release；鎖 commit 避免 `uv sync` 時被上游破壞。
- uv 管理 Python 3.12 虛擬環境於 `server/.venv`。原因：系統 Python 3.9 不符 mlx-audio 的 >=3.10。
- MLX 推理固定在一條常駐執行緒（`ThreadPoolExecutor(max_workers=1)`），load / 每次 next / gen.close / unload 全走 `run_in_executor`，**不用 `asyncio.to_thread`**。原因：MLX GPU stream 每執行緒一份，codec 串流 buffer 跨執行緒求值會拋例外；上游 mlx-audio server 同樣做法。（2026-10-15 印工實測後改）
- 後端內部一律 `stream=True` 逐段取，非串流請求自己累積再編 WAV。原因：非串流模式每個自動分段才 yield，逐段取讓中止縮到約 0.3 秒。
- 單一 uvicorn worker + 一把 asyncio lock，busy 時回 409 不排隊；查詢端點不上鎖。原因：MLX 同進程共用 GPU，單人工具不需佇列。（2026-10-15 依印工提出的縫隙拍板）
- `MOCK=1` 完全不 import mlx-audio。原因：模型未下載、甚至 mlx-audio 未裝時也能跑前端。
- 參考音檔落暫存檔再傳路徑。原因：mlx-audio `_samples()` 以路徑載入最穩；回應後即刪。
- 串流用 raw PCM s16le。原因：WAV header 需總長，串流時未知。

---

## 任務清單

### Phase 1：環境與骨架

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | `server/pyproject.toml`：python 3.12、fastapi、uvicorn[standard]、python-multipart、mlx-audio（git + 鎖 commit） | 不裝 `[server]` extra，避免 webrtcvad |
| ✅ | `server/setup.sh`：缺 uv 則 `brew install uv`；優先用既有 `/opt/homebrew/bin/python3.12`（已安裝），找不到才 `uv python install 3.12`；`uv sync` | 腳本可重複執行；不下載 Python |
| ✅ | `server/run-server.sh [port]`：`uv run --no-sync uvicorn app.main:app --host 127.0.0.1 --port 8793 --workers 1` | 支援 `MOCK=1`；`--no-sync` 啟動不改環境、`--workers 1` 明確單 worker |
| ✅ | `models/download.sh <4bit|8bit|bf16>`：`uv run hf download mlx-community/fish-audio-drama-3-<v> --local-dir models/drama-3-<v>` | Rex 已授權（2026-10-15）：腳本寫好後先下載 8bit（42 GB），背景執行。腳本完成並驗過參數檢查；自動模式擋下後改由 Rex 於 2026-10-15 在自己的終端機下載三版本（見踩雷紀錄） |
| ✅ | `models/README.md`：三版本對照、磁碟需求、下載指令 | |
| ✅ | `app/main.py` 骨架：CORS 關閉（走 proxy）、錯誤處理統一為 `{error, detail}` | |

### Phase 2：模型管理

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | `app/variants.py`：三版本常數表（id、repo、資料夾、預設取樣參數、磁碟、記憶體） | 與 spec/model-capabilities.md 一致 |
| ✅ | `app/models.py` ModelManager：掃描 `models/` 判定 available；load / unload；busy lock | `load_model(path)` 以本機路徑 |
| ✅ | `GET /v1/health`（含 busy_reason）、`GET /v1/models`、`POST /v1/models/load`、`POST /v1/models/unload` | 契約見 spec/api-conventions.md；查詢端點不上鎖 |

### Phase 3：產生

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | `app/tts.py`：multipart 解析、三組欄位等長驗證、角色編號 0–15、音檔 ≤ 60 秒、結構 token 拒收 | 錯誤碼對照 spec |
| ✅ | 逐字稿補 `<|speaker:N|> ` 前綴；暫存檔寫入 `server/tmp/`；回應後清除 | |
| ✅ | 非串流：內部仍 `stream=True` 逐段取、自己累積 → WAV → 回傳；header X-Elapsed-Seconds / X-Audio-Seconds | 輸出與原做法相同，中止更快 |
| ✅ | 串流：`model.generate(stream=True)` 逐段 → s16le → StreamingResponse | `first_chunk_frames` 設小值 |
| ✅ | generate 在**專屬單執行緒** `ThreadPoolExecutor(max_workers=1)` 執行，load / 每次 next / gen.close / unload 全走 `run_in_executor` | **不能用 `asyncio.to_thread`**，見踩雷紀錄 |
| ✅ | 連線中斷（串流與非串流皆同）→ 每片段之間檢查 `request.is_disconnected()`，斷線即停止取段並釋放鎖 | 片段約 0.3 秒音訊；generate 不能在片段中打斷，釋放鎖延遲約 0.3 秒，屬預期行為 |

### Phase 4：MOCK 與驗證

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | `app/mock.py`：依字數產生正弦波，每角色不同音高；串流每 0.3 秒一段 | `/v1/models` 三版本皆 available |
| ✅ | MOCK 模式下以 `user/http/tts.http` 跑通全部端點 | 指令分開跑、各看 exit code |
| ✅ | `docs/ops.md`：啟動 / 關閉 / 查詢 / 常見狀況 | 比照 whisper-cpp 的 ops 文件 |

### Phase 5：真模型回饋調整（依 Epic 3 Phase 1 發現，拍板 2026-10-15）

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | 每次產生結束（gen.close 之後）於 MLX 執行緒呼叫 `mx.clear_cache()` | 純實作，不動契約；Phase 2 量峰值分開記 active 與 cache。8bit 連跑 12 次後 40 GB（原 76 GB），cache 0 GB |
| ✅ | 提前中斷偵測：取段迴圈中「已出聲後連續 4 秒 < −50 dBFS」→ 關閉產生器、裁尾端靜音（保留 0.5 秒）、`X-Early-Stop: true` | 閾值放 settings 可調；不用「全零」偵測。歷史 23 檔回放 3 中 3、無誤報；真模型觸發 4 次、未誤裁 2 次。**門檻 4 秒待拍板**（新樣本正常停頓達 3.7 秒） |
| ✅ | `X-Request-Id` 兩種回應都帶；`GET /v1/tts/last` 回 request_id / early_stop / audio_seconds / elapsed_seconds / chunks | 串流結束後前端查這個；紀錄在釋放鎖前寫入 |
| ✅ | 後端 log 每次產生記一行自動分段數 | 同行記 request_id、音訊秒數、耗時、是否提前中斷 |
| ✅ | MOCK：文字含 `[mock:early-stop]` 時模擬中斷 | 給前端做提示 UI；−60 dBFS 雜訊觸發真規則，約 5.2 秒結束 |
| ✅ | docs/ops.md 同步症狀描述與新端點 | tts.http 也補了 /v1/tts/last 與 MOCK 中斷範例 |
| ✅ | 門檻 4 秒 → 6 秒（settings）；非串流回應加 `X-Chunks` header；docs/ops.md 同步 | 2026-10-15 拍板；MOCK 中斷約 7.3 秒結束、X-Chunks 與 /tts/last 一致、串流無 X-Chunks |

### Phase 6：Epic 3 Phase 2 回饋（拍板 2026-10-15）

| 狀態 | 任務 | 備註 |
|------|------|------|
| ✅ | 提前中斷偵測加第二條規則：開頭 6 秒內從未出聲（無任何 100 ms 窗 > −40 dBFS）→ 中斷，`X-Early-Stop: true` | 門檻共用 settings 的 6 秒；61 檔回放：正常 42 檔誤判 0，p2-8bit-T8-run3、p2-bf16-T8-run2 於 6.00 秒觸發；非串流只回開頭 0.5 秒 |
| ✅ | `/v1/models`：`peak_memory_gb` 改為行程峰值 55 / 72 / 103，新增 `active_memory_gb` 27 / 45 / 76 | variants.py；MOCK 回應原文核對一致 |
| ✅ | docs/ops.md 與 tts.http 同步 | 含兩條規則、log 的「規則=silence/onset」、已知限制 |

---

## 驗收標準

- [x] `bash server/setup.sh` 可重複執行，`uv run python -c "import mlx_audio"` 成功
- [x] `MOCK=1` 啟動後，`tts.http` 全部請求回應符合 spec/api-conventions.md
- [x] 非 MOCK 但模型未下載時，`/v1/models` 正確回 `available: false`，`/v1/tts` 回 503 `no_model_loaded`
- [x] 產生中中止連線（串流與非串流），health 在當前一段生成完後回 `busy=false`；MOCK 模式下可用每段 0.3 秒的假音訊驗證
- [x] 不修改任何 `.venv` 內的第三方檔案（mlx-audio、mlx、fastapi、starlette、uvicorn 共 1090 檔與安裝時 RECORD 雜湊一致）
- [x] `spec/api-conventions.md` 與實作一致（含 2026-10-15 拍板的 422、model_load_failed、busy_target、temperature ≤ 2、stream 只收 true/false）
- [x] 真模型：非 MOCK 啟動三版本 available=true；load 8bit 13.74 秒；tts.http 無參考單角色 200，耗時 6.46 秒、音訊 5.90 秒（0.91x，首次含暖機）
- [x] Phase 5：MOCK 下 /v1/tts/last、X-Request-Id、X-Early-Stop、[mock:early-stop] 符合 spec；真模型 8bit 連跑 12 次記憶體維持 40 GB；提前中斷偵測非串流與串流皆觸發、正常句未誤裁

---

## API 規格

見 [spec/api-conventions.md](../spec/api-conventions.md)。

---

## 踩雷紀錄

- **MLX 跨執行緒求值失敗**
  - 症狀：在 A 執行緒建立、尚未求值的 MLX 陣列，到 B 執行緒求值丟 `RuntimeError: There is no Stream(gpu, 0) in current thread.`
  - 根因：MLX 0.32.4 的 default stream 每條執行緒各一份；Drama 3 的 codec 串流 buffer 在兩次 `next()` 之間留著未求值陣列，`asyncio.to_thread` 每次可能換執行緒。
  - 解法：load、每次 next、gen.close、unload 全部固定在專屬 `ThreadPoolExecutor(max_workers=1)`，以 `run_in_executor` 呼叫；不用 `asyncio.to_thread`。
- **8bit 下載被自動模式擋下**
  - 症狀：實作 session 背景執行 `bash models/download.sh 8bit` 被 Claude Code 自動模式安全分類器拒絕。
  - 根因：大量下載屬分類器判定的高風險動作，CLAUDE.md 的授權無法覆蓋 session 權限設定。
  - 解法：由 Rex 在自己的終端機執行，或在設定中放行該指令；實作 session 不繞道執行。
- **斷線取消落在 send() 時鎖不釋放**
  - 症狀：Starlette 的 StreamingResponse 在斷線時，若取消剛好發生在 send()，body 產生器的 finally 不會執行，鎖卡到 GC 才釋放。
  - 根因：uvicorn 0.54（ASGI spec 2.3）下 Starlette 以 task group 取消 stream_response，`async for` 被打斷時不會 aclose 產生器；被取消的 scope 內每個 await 也會再被取消。
  - 解法：`GuardedStreamingResponse` 覆寫 `__call__`，在 finally 以 `anyio.CancelScope(shield=True)` 先 aclose body 再 finalize；finalize 冪等。
- **curl -F 傳角色標籤失敗**
  - 症狀：`curl -F 'text=<|speaker:0|> …'` exit 26、HTTP 000。
  - 根因：curl 的 `-F` 把值開頭的 `<` 當成「從檔案讀取」。
  - 解法：文字欄位一律用 `--form-string`（docs/ops.md 已註明）。
- **下載中途 config.json 先到，誤判可載入**
  - 症狀：models/drama-3-<v>/ 已有 config.json，但權重仍在 `.cache/huggingface/download/*.incomplete`。
  - 根因：hf download 先寫小檔，大檔完成才改名；repo 沒有 safetensors 索引檔，無法從檔名得知總數。
  - 解法：`app/availability.py` 以 hf 的 trees 檔案清單逐檔比對大小，無清單時看必需檔與編號連續，有 .incomplete 一律不可用；每次查詢重新判定。
- **中斷尾巴有時是全零、有時是極小雜訊**
  - 症狀：8bit 中斷後的尾巴有時是數位全零，有時是 −70 dBFS 左右的雜訊。
  - 根因：codec 輸出尾端有時量化落到 0，有時殘留雜訊。
  - 解法：偵測一律用 100 ms RMS 對 dBFS 門檻，不寫「全零」判斷。
- **驗證用的埠被其他測試程序佔用**
  - 症狀：指定的 8795 開工時已在 listen（前端子代理餵測試音檔的 CORS 小伺服器）。
  - 根因：多個子代理並行，各自臨時開埠。
  - 解法：開埠前先 lsof 檢查；只用自己的 PID 關伺服器，不 pkill 全部 uvicorn。
