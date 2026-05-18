from __future__ import annotations

from backend.domain.res import fail


def unauthorized_response(message: str = "未登录或登录已过期") -> dict:
    return fail(message, code="UNAUTHORIZED")
