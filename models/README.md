# models/ — Fish Audio Drama 3 權重

三個 MLX 量化版本各放一個資料夾，後端掃描此目錄判定哪些版本可用。
權重不進版控（見根目錄 `.gitignore`），**不會自動下載**，由 Rex 手動執行下載腳本。

## 三版本對照

數字以 [spec/model-capabilities.md](../spec/model-capabilities.md) 為準。

| 版本 id | HuggingFace repo | 磁碟 | 執行峰值記憶體 | 預設取樣參數 (temperature / top_p / top_k) | 說明 |
|---------|------------------|------|----------------|-------------------------------------------|------|
| `4bit` | mlx-community/fish-audio-drama-3-4bit | 22 GB | 約 26 GB | 0.7 / 0.7 / 30 | 路由 expert 4-bit、其餘 8-bit；最省記憶體 |
| `8bit` | mlx-community/fish-audio-drama-3-8bit | 42 GB | 約 49 GB | 1.0 / 0.9 / 30 | 路由 expert 8-bit、其餘 bf16；**建議預設** |
| `bf16` | mlx-community/fish-audio-drama-3-bf16 | 67 GB | 估 75 GB 以上 | 0.7 / 0.7 / 30 | 不量化，最接近原版 |

- 一次只載入一個版本；8bit 加 bf16 同時載入會超過 128 GB。
- 三個版本皆為社群轉換，授權沿用 Fish Audio Community License（自用工具定位）。

## 下載

前置：先跑過 `bash server/setup.sh`（下載腳本使用 `server/.venv` 裡的 `hf` CLI）。

```bash
bash models/download.sh 8bit    # 建議先抓這個，約 42 GB
bash models/download.sh 4bit    # 約 22 GB
bash models/download.sh bf16    # 約 67 GB
```

- 從任何目錄呼叫皆可，檔案一律寫到本資料夾下的 `drama-3-<版本>/`。
- 使用 `hf download --local-dir`，**不走** `~/.cache/huggingface` 的預設快取，所以不會佔兩份磁碟。
- 中斷（Ctrl+C、斷網）後重跑同一行即可續傳；已完成的檔案會跳過。
- 結束時腳本會確認 `config.json` 存在並印出資料夾大小。
- 檔案很大，建議背景執行並留 log：

```bash
nohup bash models/download.sh 8bit > /tmp/drama3-download-8bit.log 2>&1 &
tail -f /tmp/drama3-download-8bit.log
```

## 資料夾結構

```
models/
├── README.md              本檔
├── download.sh            下載腳本
├── drama-3-4bit/          （下載後才出現，不進版控）
├── drama-3-8bit/
│   ├── config.json        model_type = "fish_drama3"
│   ├── tokenizer.json     含 <|speaker:0|> ～ <|speaker:15|> 等特殊 token
│   ├── tokenizer_config.json / special_tokens_map.json
│   ├── model-0000N.safetensors   主幹 + 音訊 tower 權重（分片）
│   ├── codec.safetensors  Fish S1 DAC 編解碼器（44.1 kHz）
│   └── .cache/huggingface/       hf download 的續傳中繼資料，勿手動修改
└── drama-3-bf16/
```

實際檔名以下載結果為準；後端以「資料夾內有 `config.json`」判定該版本可用，
並以本機路徑呼叫 `mlx_audio.tts.utils.load_model(<資料夾路徑>)`，載入時不連網。

## 刪除某個版本

確認後端沒有載入該版本後，直接刪資料夾：

```bash
rm -rf models/drama-3-bf16
```
