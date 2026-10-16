"""ModelManager：版本清單、載入 / 卸載、唯一的一把忙碌鎖。

並行規則（spec/api-conventions.md「並行規則」）：
- 只有一把鎖，產生與載入 / 卸載共用；持鎖期間 busy=true。
- 不排隊：鎖被占用時，/v1/tts、load、unload 一律立刻 409 busy。
- /v1/health、/v1/models 不碰鎖。
鎖是單純的旗標：event loop 是單執行緒，「檢查 + 設定」之間沒有 await 就是原子操作。
"""

import logging
import time

from .audio import Backend
from .errors import ApiError
from .variants import VARIANTS, Variant
from .worker import run_mlx

logger = logging.getLogger("drama3.models")

BUSY_DETAIL = {
    "generating": "後端正在產生語音，請稍候",
    "loading": "後端正在載入模型，請稍候",
    "unloading": "後端正在卸載模型，請稍候",
}


class BusyLock:
    def __init__(self) -> None:
        self.reason: str | None = None  # generating / loading / unloading / None
        self.target: str | None = None  # loading 時為正在載入的版本 id，其餘 None

    @property
    def busy(self) -> bool:
        return self.reason is not None

    def try_acquire(self, reason: str, target: str | None = None) -> bool:
        if self.reason is not None:
            return False
        self.reason = reason
        self.target = target if reason == "loading" else None
        return True

    def release(self) -> None:
        self.reason = None
        self.target = None


class ModelManager:
    def __init__(self, backend: Backend) -> None:
        self.backend = backend
        self.lock = BusyLock()
        self.loaded: Variant | None = None
        self._model: object | None = None
        # 最近一次（回過 200 的）產生結果，供 GET /v1/tts/last；單人工具，鎖保證「最近一次」明確
        self.last_generation: dict | None = None

    @property
    def mock(self) -> bool:
        return self.backend.mock

    # ---------- 查詢（不碰鎖） ----------

    def health(self) -> dict:
        return {
            "status": "ok",
            "mock": self.mock,
            "loaded": self.loaded.id if self.loaded else None,
            "busy": self.lock.busy,
            "busy_reason": self.lock.reason,
            "busy_target": self.lock.target,
        }

    def list_models(self) -> list[dict]:
        items = []
        for v in VARIANTS.values():
            available, _ = self.backend.is_available(v)  # 每次重新判定，不快取
            items.append(
                {
                    "id": v.id,
                    "name": v.name,
                    "available": available,
                    "loaded": self.loaded is not None and self.loaded.id == v.id,
                    "disk_gb": v.disk_gb,
                    "peak_memory_gb": v.peak_memory_gb,
                    "active_memory_gb": v.active_memory_gb,
                    "defaults": v.defaults.as_dict(),
                }
            )
        return items

    # ---------- 鎖 ----------

    def busy_error(self) -> ApiError:
        reason = self.lock.reason or "generating"
        return ApiError(409, "busy", BUSY_DETAIL.get(reason, "後端忙碌中，請稍候"))

    def acquire_for_generation(self) -> tuple[object, Variant]:
        """取得產生用的鎖並回傳 (模型, 版本)。busy → 409；未載入 → 503。"""
        if self.lock.busy:
            raise self.busy_error()
        if self._model is None or self.loaded is None:
            raise ApiError(503, "no_model_loaded", "尚未載入任何模型版本，請先到版本選單載入")
        self.lock.try_acquire("generating")
        return self._model, self.loaded

    def release(self) -> None:
        self.lock.release()

    # ---------- 載入 / 卸載 ----------

    async def load(self, variant_id: str) -> dict:
        variant = VARIANTS.get(variant_id)
        if variant is None:
            raise ApiError(
                400, "unknown_model", f"不認得的版本 {variant_id!r}；可用：{', '.join(VARIANTS)}"
            )
        if self.lock.busy:
            raise self.busy_error()
        if self.loaded is not None and self.loaded.id == variant.id:
            return {"loaded": variant.id, "seconds": 0.0}  # 同 id 重複載入：不重載
        available, reason = self.backend.is_available(variant)
        if not available:
            raise ApiError(
                404,
                "model_not_available",
                f"{variant.id} 不可用：{reason or '尚未下載'}；請先執行 bash models/download.sh {variant.id}",
            )

        self.lock.try_acquire("loading", variant.id)
        started = time.perf_counter()
        try:
            if self._model is not None:  # 載入前先卸載目前版本
                previous = self.loaded.id if self.loaded else "?"
                try:
                    await self._unload_current()
                except Exception as exc:
                    # _unload_current 一開始就清掉參考，所以失敗後 loaded 也是 null（同契約）
                    logger.exception("切換版本：卸載 %s 失敗", previous)
                    raise ApiError(
                        500,
                        "model_load_failed",
                        f"卸載目前版本 {previous} 時失敗，未載入 {variant.id}：{exc}",
                    ) from None
                logger.info("切換版本：已卸載 %s", previous)
            logger.info("開始載入 %s（%s）", variant.id, variant.folder)
            try:
                model = await run_mlx(self.backend.load, variant)
            except Exception as exc:
                logger.exception("載入 %s 失敗", variant.id)
                raise ApiError(500, "model_load_failed", f"載入 {variant.id} 失敗：{exc}") from None
            self._model = model
            self.loaded = variant
            seconds = round(time.perf_counter() - started, 2)
            logger.info("載入完成 %s，耗時 %.2f 秒", variant.id, seconds)
            return {"loaded": variant.id, "seconds": seconds}
        finally:
            self.lock.release()

    async def unload(self) -> dict:
        if self.lock.busy:
            raise self.busy_error()
        if self._model is None:
            return {"loaded": None}
        self.lock.try_acquire("unloading")
        try:
            previous = self.loaded.id if self.loaded else "?"
            started = time.perf_counter()
            await self._unload_current()
            logger.info("已卸載 %s，耗時 %.2f 秒", previous, time.perf_counter() - started)
            return {"loaded": None}
        finally:
            self.lock.release()

    async def _unload_current(self) -> None:
        # 模型參考放進 holder 交給 MLX 執行緒清掉，event loop 這邊不留任何參考
        holder = [self._model]
        self._model = None
        self.loaded = None
        await run_mlx(self.backend.unload, holder)
