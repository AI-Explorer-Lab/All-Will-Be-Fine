from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from dataclasses import dataclass
from typing import Any

from backend.config.config import load_config
from backend.domain.models import UserContext
from backend.exceptions.business_exception import AuthenticationException, ConflictException, ValidationException
from backend.mapper.user_mapper import UserMapper


PBKDF2_ITERATIONS = 210_000
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-.@]{3,64}$")
_DEFAULT_DEV_SECRET = secrets.token_urlsafe(32)


@dataclass
class AuthResult:
    access_token: str
    token_type: str
    expires_in: int
    user: UserContext


class AuthService:
    def __init__(self, mapper: UserMapper | None = None, secret: str | None = None):
        self.mapper = mapper or UserMapper()
        self.secret = secret or _auth_secret()

    def register(self, payload: dict[str, Any]) -> AuthResult:
        username = _normalize_username(payload.get("username"))
        password = str(payload.get("password") or "")
        _validate_password(password)

        password_hash = hash_password(password)
        try:
            user = self.mapper.create_user(username, password_hash)
        except ValueError:
            raise ConflictException("账号已存在")
        return self._result_for_user(user.id, user.username or username)

    def login(self, payload: dict[str, Any]) -> AuthResult:
        username = _normalize_username(payload.get("username"))
        password = str(payload.get("password") or "")
        user = self.mapper.get_by_username(username)
        if user is None or not user.password_hash or not verify_password(password, user.password_hash):
            raise AuthenticationException("账号或密码错误")
        return self._result_for_user(user.id, user.username or username)

    def current_user_from_token(self, token: str) -> UserContext:
        payload = self.decode_token(token)
        user_id = str(payload.get("sub") or "")
        if not user_id:
            raise AuthenticationException("未登录或登录已过期")
        user = self.mapper.get_by_id(user_id)
        if user is None or not user.username:
            raise AuthenticationException("未登录或登录已过期")
        return UserContext(user_id=user.id, username=user.username or "")

    def decode_token(self, token: str) -> dict[str, Any]:
        try:
            payload_part, signature_part = token.split(".", 1)
            expected = _sign(payload_part, self.secret)
            if not hmac.compare_digest(signature_part, expected):
                raise ValueError("bad signature")
            payload = json.loads(_b64decode(payload_part))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            raise AuthenticationException("未登录或登录已过期")
        if int(payload.get("exp") or 0) < int(time.time()):
            raise AuthenticationException("未登录或登录已过期")
        return payload

    def _result_for_user(self, user_id: str, username: str) -> AuthResult:
        user = UserContext(user_id=user_id, username=username)
        token = self.create_token(user_id, username)
        return AuthResult(access_token=token, token_type="bearer", expires_in=TOKEN_TTL_SECONDS, user=user)

    def create_token(self, user_id: str, username: str) -> str:
        now = int(time.time())
        payload = {
            "sub": user_id,
            "username": username,
            "iat": now,
            "exp": now + TOKEN_TTL_SECONDS,
        }
        payload_part = _b64encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        return f"{payload_part}.{_sign(payload_part, self.secret)}"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        _b64encode(salt),
        _b64encode(digest),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, digest = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual_digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            _b64decode(salt),
            int(iterations),
        )
        return hmac.compare_digest(_b64encode(actual_digest), digest)
    except (ValueError, TypeError):
        return False


def _normalize_username(value: Any) -> str:
    username = str(value or "").strip().lower()
    if not USERNAME_PATTERN.fullmatch(username):
        raise ValidationException("账号需为 3-64 位字母、数字、下划线、点、横线或邮箱格式")
    return username


def _validate_password(password: str) -> None:
    if len(password) < 8 or len(password) > 128:
        raise ValidationException("密码长度需为 8-128 位")
    if password.strip() != password:
        raise ValidationException("密码首尾不能包含空格")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValidationException("密码需同时包含字母和数字")


def _auth_secret() -> str:
    config = load_config()
    config_secret = config.get("auth", {}).get("secret_key")
    secret = os.getenv("AUTH_SECRET") or config_secret
    if secret:
        return secret
    if config.get("environment") != "local":
        raise RuntimeError("AUTH_SECRET is required outside local development")
    return _DEFAULT_DEV_SECRET


def _sign(payload_part: str, secret: str) -> str:
    signature = hmac.new(secret.encode("utf-8"), payload_part.encode("utf-8"), hashlib.sha256).digest()
    return _b64encode(signature)


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
