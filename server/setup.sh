#!/usr/bin/env bash
# 一鍵準備後端環境：安裝 uv、選 Python 3.12、依賴套件（含鎖定 commit 的 mlx-audio）。
# 用法：bash server/setup.sh（從任何目錄呼叫皆可；可重複執行）
# 註：本腳本不下載模型。模型由 bash models/download.sh <4bit|8bit|bf16> 手動下載。
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

echo "==> 1/3 檢查 uv"
if ! command -v uv >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 || { echo "找不到 brew，請先安裝 Homebrew 或手動安裝 uv"; exit 1; }
  echo "    安裝 uv（brew）"
  brew install uv
else
  echo "    已安裝：$(uv --version)"
fi

echo "==> 2/3 準備 Python 3.12（優先用 Homebrew 既有的，不動系統 Python 3.9）"
BREW_PY="/opt/homebrew/bin/python3.12"
if [ -x "$BREW_PY" ]; then
  PY="$BREW_PY"
  echo "    使用既有：$PY（$("$PY" --version)）"
else
  echo "    找不到 $BREW_PY，改由 uv 安裝 Python 3.12"
  uv python install 3.12
  PY="3.12"
fi

echo "==> 3/3 同步依賴到 $HERE/.venv"
cd "$HERE"
# .venv 若是別的直譯器建的，uv sync --python 會自動重建
uv sync --python "$PY"

echo "==> 完成。啟動：bash server/run-server.sh（模型未下載時用 MOCK=1 bash server/run-server.sh）"
