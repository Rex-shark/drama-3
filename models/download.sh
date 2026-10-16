#!/usr/bin/env bash
# 下載 Fish Audio Drama 3 的 MLX 權重到 models/drama-3-<版本>/。
# 用法：bash models/download.sh <4bit|8bit|bf16>
# 由 Rex 手動執行；檔案很大（22 / 42 / 67 GB），中斷後重跑會續傳、不重抓已完成的檔案。
# 前置：bash server/setup.sh（提供 uv 環境裡的 hf CLI）
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"            # models/
SERVER_DIR="$(cd "$HERE/../server" && pwd)"     # server/（uv 專案）

usage() {
  echo "用法：bash models/download.sh <4bit|8bit|bf16>"
  echo "  4bit  約 22 GB，峰值記憶體約 26 GB"
  echo "  8bit  約 42 GB，峰值記憶體約 49 GB（建議預設）"
  echo "  bf16  約 67 GB，峰值記憶體估 75 GB 以上"
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

VARIANT="$1"
case "$VARIANT" in
  4bit|8bit|bf16) ;;
  -h|--help) usage; exit 0 ;;
  *) echo "不支援的版本：$VARIANT"; usage; exit 2 ;;
esac

REPO="mlx-community/fish-audio-drama-3-$VARIANT"
DEST="$HERE/drama-3-$VARIANT"

command -v uv >/dev/null 2>&1 || { echo "找不到 uv，請先跑 bash server/setup.sh"; exit 1; }
[ -d "$SERVER_DIR/.venv" ] || { echo "找不到 $SERVER_DIR/.venv，請先跑 bash server/setup.sh"; exit 1; }

echo "==> 下載 $REPO"
echo "    目的地：$DEST"
mkdir -p "$DEST"

# --local-dir：直接寫進專案的 models/，不走 ~/.cache/huggingface 的預設快取。
# hf download 會比對 $DEST/.cache/huggingface/ 的中繼資料，已完成的檔案跳過、未完成的續傳。
uv run --no-sync --project "$SERVER_DIR" hf download "$REPO" --local-dir "$DEST"

if [ ! -f "$DEST/config.json" ]; then
  echo "下載結束但找不到 $DEST/config.json，請重跑本腳本續傳"
  exit 1
fi

echo "==> 完成：$DEST"
du -sh "$DEST"
