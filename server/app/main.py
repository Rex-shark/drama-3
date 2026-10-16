"""drama-3 後端進入點：FastAPI app、lifespan、錯誤處理、health / models 端點。

啟動：bash server/run-server.sh（MOCK=1 不載模型）。只綁 127.0.0.1；CORS 不開（前端走 Vite proxy）。
"""

import logging
import os
import shutil
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from pydantic import BaseModel

from . import worker
from .errors import install_error_handlers
from .models import ModelManager
from .settings import MOCK, MODELS_DIR, TMP_DIR, TMP_ROOT
from .tts import router as tts_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("drama3")


def _make_backend():
    if MOCK:
        from .mock import MockBackend  # MOCK：完全不 import mlx_audio

        return MockBackend()
    from .mlx_backend import MlxBackend  # 模組頂層不 import mlx_audio，載入模型時才 import

    return MlxBackend()


def _pid_alive(pid: int) -> bool:
    """該 pid 的行程是否還在。PermissionError 代表行程存在、只是不屬於自己。"""
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return True  # 判斷不了就當作還活著，寧可留著也不要刪到別人的檔
    return True


def _prepare_tmp() -> None:
    """建立本行程的 tmp/<pid>/，並清掉 pid 已不存在的殘留子目錄（行程被 kill -9 時留下的）。

    只動自己的子目錄與已死行程的子目錄；還活著的行程（例如另一個 port 的後端）一律不碰。
    """
    own = os.getpid()
    if TMP_ROOT.is_dir():
        for path in TMP_ROOT.iterdir():
            if not path.is_dir() or not path.name.isdigit():
                continue
            pid = int(path.name)
            if pid == own or not _pid_alive(pid):
                # 自己的：pid 被重用時可能是舊行程留下的，清空重來
                shutil.rmtree(path, ignore_errors=True)
                if pid != own:
                    logger.info("已清掉殘留暫存目錄 %s（行程 %d 已不存在）", path, pid)
    TMP_DIR.mkdir(parents=True, exist_ok=True)


def _remove_own_tmp() -> None:
    """關閉時連同本行程的子目錄一起移除。"""
    shutil.rmtree(TMP_DIR, ignore_errors=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager = ModelManager(_make_backend())
    app.state.manager = manager
    _prepare_tmp()
    available = [m["id"] for m in manager.list_models() if m["available"]]
    logger.info(
        "drama-3 後端啟動：%s；模型目錄 %s；暫存目錄 %s；可用版本：%s",
        "MOCK 模式（假音訊）" if MOCK else "真模型模式",
        MODELS_DIR,
        TMP_DIR,
        "、".join(available) or "無",
    )
    try:
        yield
    finally:
        worker.shutdown()
        _remove_own_tmp()
        logger.info("drama-3 後端已關閉")


app = FastAPI(title="drama-3 TTS 後端", version="1.0", lifespan=lifespan)
install_error_handlers(app)
app.include_router(tts_router)


class LoadRequest(BaseModel):
    id: str


@app.get("/v1/health")
async def health(request: Request) -> dict:
    return request.app.state.manager.health()


@app.get("/v1/models")
async def list_models(request: Request) -> list[dict]:
    return request.app.state.manager.list_models()


@app.post("/v1/models/load")
async def load_model(body: LoadRequest, request: Request) -> dict:
    return await request.app.state.manager.load(body.id)


@app.post("/v1/models/unload")
async def unload_model(request: Request) -> dict:
    return await request.app.state.manager.unload()
