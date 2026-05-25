from __future__ import annotations

from typing import Optional

from fastapi import Header

from backend.domain.models import UserContext
from backend.exceptions.business_exception import AuthenticationException
from backend.service.auth_service import AuthService


auth_service = AuthService()


def get_current_user(authorization: Optional[str] = Header(default=None)) -> UserContext:
    if not authorization:
        raise AuthenticationException("请先登录")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthenticationException("请先登录")
    return auth_service.current_user_from_token(token)
