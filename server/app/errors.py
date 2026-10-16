"""統一錯誤格式 {error, detail}。"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("drama3")


class ApiError(Exception):
    """可預期的 API 錯誤；由例外處理器轉成 {error, detail}。"""

    def __init__(self, status: int, error: str, detail: str) -> None:
        super().__init__(f"{status} {error}: {detail}")
        self.status = status
        self.error = error
        self.detail = detail


def error_response(status: int, error: str, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": error, "detail": detail})


_HTTP_ERROR_CODES = {
    400: "bad_request",
    404: "not_found",
    405: "method_not_allowed",
    413: "payload_too_large",
}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.status, exc.error, exc.detail)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        parts = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", ()) if p != "body")
            parts.append(f"{loc or '請求'}：{err.get('msg', '格式錯誤')}")
        return error_response(422, "invalid_request", "請求格式錯誤：" + "；".join(parts))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_ERROR_CODES.get(exc.status_code, f"http_{exc.status_code}")
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        if exc.status_code == 404:
            detail = "找不到這個端點"
        elif exc.status_code == 405:
            detail = "此端點不支援這個 HTTP 方法"
        return error_response(exc.status_code, code, detail)

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("未預期的錯誤")
        return error_response(500, "internal_error", f"伺服器內部錯誤：{exc}")
