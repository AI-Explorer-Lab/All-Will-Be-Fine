from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from backend.domain.res import fail
from backend.exceptions.business_exception import AuthenticationException, BusinessException, ConflictException


def register_exception_handlers(app) -> None:
    @app.exception_handler(BusinessException)
    async def handle_business_exception(request: Request, exc: BusinessException):
        status_code = 400
        if isinstance(exc, AuthenticationException):
            status_code = 401
        if isinstance(exc, ConflictException):
            status_code = 409
        return JSONResponse(status_code=status_code, content=fail(exc.message, exc.code))

    @app.exception_handler(Exception)
    async def handle_exception(request: Request, exc: Exception):
        return JSONResponse(status_code=500, content=fail("服务暂时不可用", "INTERNAL_ERROR"))
