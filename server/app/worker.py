"""MLX 專屬執行緒。

MLX 的 default stream 是 thread-local：在 A 執行緒建出、尚未 eval 的 lazy 陣列拿到
B 執行緒用會丟 RuntimeError（見 mlx-audio 筆記第 9 節）。Drama 3 跨 next() 留有未 eval
的陣列（codec 串流 buffer 等），所以載入、建立產生器、每次 next、gen.close、卸載、
mx.clear_cache 全部固定丟到這條單一執行緒。不要用 asyncio.to_thread（它用多條 worker）。

MOCK 模式也走同一條執行緒（以 time.sleep 模擬生成），讓「斷線後要等當前一段跑完才
釋放鎖」的行為與真模型一致。
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

# max_workers=1：執行緒在第一次 submit 時建立，之後常駐。
MLX_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mlx")


async def run_mlx(fn: Callable[..., Any], *args: Any) -> Any:
    """在 MLX 專屬執行緒執行 fn(*args)。

    注意：等待中的 coroutine 被取消時，執行緒上已開始的工作不會中止，會跑完；
    之後再 submit 的工作（例如 gen.close）會排在它後面，依序在同一條執行緒執行。
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(MLX_EXECUTOR, fn, *args)


def shutdown() -> None:
    MLX_EXECUTOR.shutdown(wait=False, cancel_futures=True)
