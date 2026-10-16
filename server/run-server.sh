#!/usr/bin/env bash
# 啟動 drama-3 後端（FastAPI，只綁 127.0.0.1）。
# 用法：bash server/run-server.sh [port]        預設 8793
#       MOCK=1 bash server/run-server.sh        不載模型，回傳假音訊
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8793}"   # 避開 whisper-cpp 專案的 8791 / 8792

command -v uv >/dev/null 2>&1 || { echo "找不到 uv，請先跑 bash server/setup.sh"; exit 1; }
[ -d "$HERE/.venv" ] || { echo "找不到 $HERE/.venv，請先跑 bash server/setup.sh"; exit 1; }

cd "$HERE"
# MOCK 等環境變數由 exec 原樣繼承；單一 worker（MLX 同進程共用 GPU）。
# --no-sync：不在啟動時改動環境，依賴變更一律走 setup.sh。
exec uv run --no-sync uvicorn app.main:app \
  --host 127.0.0.1 \
  --port "$PORT" \
  --workers 1
