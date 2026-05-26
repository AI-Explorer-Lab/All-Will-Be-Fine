from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from backend.config.config import load_config
from backend.database.models import CalibrationCardEntity, MethodCardEntity, ReviewEntity, UserEntity
from backend.database.session import create_session_factory, get_db_type
from backend.exceptions.business_exception import AuthenticationException
from backend.mapper.memory_review_mapper import MemoryReviewMapper
from backend.mapper.user_mapper import MemoryUserMapper


MONITOR_ADMIN_USERNAME = "admin"
MONITOR_ADMIN_PASSWORD_HASH = "57a110735735c4bd23c4f7c4c1dd7b048a247660e7f4337c7d4c581cf47dc2c9"
MONITOR_TOKEN_TTL_SECONDS = 8 * 60 * 60
_DEFAULT_MONITOR_SECRET = "local-monitor-secret-change-me"


@dataclass
class RequestMetric:
    method: str
    path: str
    status_code: int
    duration_ms: int
    error: str
    created_at: datetime


@dataclass
class AiMetric:
    operation: str
    ok: bool
    fallback: bool
    duration_ms: int
    warning: str
    created_at: datetime


REQUEST_METRICS: deque[RequestMetric] = deque(maxlen=1000)
AI_METRICS: deque[AiMetric] = deque(maxlen=500)


def record_request_metric(method: str, path: str, status_code: int, duration_ms: int, error: str = "") -> None:
    if path.startswith("/api/monitor"):
        return
    REQUEST_METRICS.append(
        RequestMetric(
            method=method.upper(),
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            error=error,
            created_at=datetime.utcnow(),
        )
    )


def record_ai_metric(operation: str, ok: bool, fallback: bool, duration_ms: int, warning: str = "") -> None:
    AI_METRICS.append(
        AiMetric(
            operation=operation,
            ok=ok,
            fallback=fallback,
            duration_ms=duration_ms,
            warning=warning,
            created_at=datetime.utcnow(),
        )
    )


class MonitorAuthService:
    def __init__(self, secret: str | None = None):
        self.secret = secret or _monitor_secret()

    def login(self, payload: dict[str, Any]) -> dict[str, Any]:
        username = str(payload.get("username") or "").strip()
        password = str(payload.get("password") or "")
        expected_hash = os.getenv("MONITOR_ADMIN_PASSWORD_HASH") or MONITOR_ADMIN_PASSWORD_HASH
        password_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        if username != MONITOR_ADMIN_USERNAME or not hmac.compare_digest(password_hash, expected_hash):
            raise AuthenticationException("监控账号或密码不正确")
        now = int(time.time())
        token = self._create_token(now)
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": MONITOR_TOKEN_TTL_SECONDS,
            "user": {"username": MONITOR_ADMIN_USERNAME, "role": "monitor_admin"},
        }

    def require_admin(self, authorization: str | None) -> dict[str, Any]:
        if not authorization:
            raise AuthenticationException("请先登录监控中心")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise AuthenticationException("请先登录监控中心")
        return self.decode_token(token)

    def decode_token(self, token: str) -> dict[str, Any]:
        try:
            payload_part, signature_part = token.split(".", 1)
            if not hmac.compare_digest(signature_part, _sign(payload_part, self.secret)):
                raise ValueError("bad signature")
            payload = json.loads(_b64decode(payload_part))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            raise AuthenticationException("监控登录已过期")
        if int(payload.get("exp") or 0) < int(time.time()):
            raise AuthenticationException("监控登录已过期")
        if payload.get("sub") != MONITOR_ADMIN_USERNAME:
            raise AuthenticationException("监控登录已过期")
        return payload

    def _create_token(self, now: int) -> str:
        payload = {"sub": MONITOR_ADMIN_USERNAME, "role": "monitor_admin", "iat": now, "exp": now + MONITOR_TOKEN_TTL_SECONDS}
        payload_part = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        return f"{payload_part}.{_sign(payload_part, self.secret)}"


class MonitorService:
    def summary(self) -> dict[str, Any]:
        now = datetime.utcnow()
        config = load_config()
        db = self._database_snapshot()
        database_public = {key: value for key, value in db.items() if key != "rows"}
        request_snapshot = self._request_snapshot()
        ai_snapshot = self._ai_snapshot()
        return {
            "generated_at": _format_utc(now),
            "environment": config.get("environment") or "local",
            "api_base": "/api",
            "database": database_public,
            "agent": {
                "provider": config.get("agent", {}).get("provider") or "unknown",
                "model": config.get("agent", {}).get("model") or "unknown",
                "timeout_seconds": config.get("agent", {}).get("timeout_seconds") or 15,
                "api_key_configured": bool(os.getenv(config.get("agent", {}).get("api_key_env") or "OPENAI_API_KEY")),
            },
            "business": db["business"],
            "dependencies": self._dependencies(db, ai_snapshot),
            "trend": self._trend(db),
            "api_quality": request_snapshot["api_quality"],
            "recent_errors": request_snapshot["recent_errors"],
            "ai_quality": ai_snapshot,
            "content": self._content_snapshot(db),
            "pending": self._pending_snapshot(db),
            "users": db.get("users", []),
        }

    def _database_snapshot(self) -> dict[str, Any]:
        if get_db_type() == "postgres":
            return self._postgres_snapshot()
        return self._memory_snapshot()

    def _postgres_snapshot(self) -> dict[str, Any]:
        started = time.perf_counter()
        try:
            session_factory = create_session_factory()
            with session_factory() as session:
                engine = session.get_bind()
                inspector = inspect(engine)
                tables = set(inspector.get_table_names())
                user_rows = session.query(UserEntity).order_by(UserEntity.created_at.desc()).all() if "users" in tables else []
                reviews = session.query(ReviewEntity).filter(ReviewEntity.deleted_at.is_(None)).all() if "reviews" in tables else []
                deleted = session.query(ReviewEntity).filter(ReviewEntity.deleted_at.is_not(None)).count() if "reviews" in tables else 0
                methods = session.query(MethodCardEntity).all() if "method_cards" in tables else []
                calibrations = session.query(CalibrationCardEntity).all() if "calibration_cards" in tables else []
        except SQLAlchemyError as error:
            return self._empty_db_snapshot("postgres", False, int((time.perf_counter() - started) * 1000), str(error))

        return self._snapshot_from_rows(
            db_type="postgres",
            connected=True,
            latency_ms=int((time.perf_counter() - started) * 1000),
            tables=tables,
            users=user_rows,
            reviews=reviews,
            deleted=deleted,
            methods=methods,
            calibrations=calibrations,
        )

    def _memory_snapshot(self) -> dict[str, Any]:
        reviews = [record for records in MemoryReviewMapper._reviews.values() for record in records.values()]
        methods = [card for cards in MemoryReviewMapper._methods.values() for card in cards.values()]
        calibrations = [card for cards in MemoryReviewMapper._calibrations.values() for card in cards.values()]
        users = list(MemoryUserMapper._users_by_id.values())
        return self._snapshot_from_rows(
            db_type="memory",
            connected=True,
            latency_ms=0,
            tables={"users", "reviews", "method_cards", "calibration_cards"},
            users=users,
            reviews=reviews,
            deleted=0,
            methods=methods,
            calibrations=calibrations,
        )

    def _snapshot_from_rows(
        self,
        db_type: str,
        connected: bool,
        latency_ms: int,
        tables: set[str],
        users: list[Any],
        reviews: list[Any],
        deleted: int,
        methods: list[Any],
        calibrations: list[Any],
    ) -> dict[str, Any]:
        event_count = sum(1 for item in reviews if _attr(item, "type") == "event")
        anxiety_count = sum(1 for item in reviews if _attr(item, "type") == "anxiety")
        pending_count = sum(1 for item in calibrations if (_attr(item, "status") or "pending") == "pending")
        verified_count = sum(1 for item in calibrations if (_attr(item, "status") or "") == "verified")
        return {
            "type": db_type,
            "connected": connected,
            "latency_ms": latency_ms,
            "error": "",
            "tables": {table: table in tables for table in ["users", "reviews", "method_cards", "calibration_cards"]},
            "users": [_user_payload(user) for user in users],
            "rows": {"reviews": reviews, "methods": methods, "calibrations": calibrations},
            "business": {
                "users": len(users),
                "reviews": len(reviews),
                "events": event_count,
                "anxiety": anxiety_count,
                "methods": len(methods),
                "calibrations": len(calibrations),
                "pending_calibrations": pending_count,
                "verified_calibrations": verified_count,
                "deleted_reviews": deleted,
            },
        }

    def _empty_db_snapshot(self, db_type: str, connected: bool, latency_ms: int, error: str) -> dict[str, Any]:
        return {
            "type": db_type,
            "connected": connected,
            "latency_ms": latency_ms,
            "error": error,
            "tables": {table: False for table in ["users", "reviews", "method_cards", "calibration_cards"]},
            "rows": {"reviews": [], "methods": [], "calibrations": []},
            "business": {
                "users": 0,
                "reviews": 0,
                "events": 0,
                "anxiety": 0,
                "methods": 0,
                "calibrations": 0,
                "pending_calibrations": 0,
                "verified_calibrations": 0,
                "deleted_reviews": 0,
            },
        }

    def _dependencies(self, db: dict[str, Any], ai: dict[str, Any]) -> list[dict[str, Any]]:
        now = _format_utc(datetime.utcnow())
        rows = [
            {"component": "后端服务", "status": "正常", "latency_ms": 0, "error": "", "checked_at": now},
            {"component": f"数据库 ({db['type']})", "status": "正常" if db["connected"] else "异常", "latency_ms": db["latency_ms"], "error": db["error"], "checked_at": now},
        ]
        rows.extend(
            {
                "component": f"关键表：{table}",
                "status": "存在" if exists else "缺失",
                "latency_ms": None,
                "error": "",
                "checked_at": now,
            }
            for table, exists in db["tables"].items()
        )
        rows.append(
            {
                "component": "大模型接口",
                "status": "正常" if ai["success_rate"] >= 50 or ai["total"] == 0 else "异常",
                "latency_ms": ai["avg_latency_ms"],
                "error": ai["latest_warning"],
                "checked_at": now,
            }
        )
        return rows

    def _trend(self, db: dict[str, Any]) -> list[dict[str, Any]]:
        today = datetime.utcnow().date()
        review_counts = Counter()
        method_counts = Counter()
        calibration_counts = Counter()
        active_users = defaultdict(set)
        for record in db["rows"]["reviews"]:
            created = _date_value(_attr(record, "created_at"))
            if created:
                review_counts[created] += 1
                user_id = _attr(record, "user_id")
                if user_id:
                    active_users[created].add(user_id)
        for card in db["rows"]["methods"]:
            created = _date_value(_attr(card, "created_at"))
            if created:
                method_counts[created] += 1
        for card in db["rows"]["calibrations"]:
            created = _date_value(_attr(card, "created_at"))
            if created:
                calibration_counts[created] += 1
        return [
            {
                "date": (today - timedelta(days=offset)).isoformat(),
                "reviews": review_counts[today - timedelta(days=offset)],
                "methods": method_counts[today - timedelta(days=offset)],
                "calibrations": calibration_counts[today - timedelta(days=offset)],
                "active_users": len(active_users[today - timedelta(days=offset)]),
                "save_rate": 0,
            }
            for offset in range(7, -1, -1)
        ]

    def _request_snapshot(self) -> dict[str, Any]:
        grouped: dict[tuple[str, str], list[RequestMetric]] = defaultdict(list)
        for metric in REQUEST_METRICS:
            grouped[(metric.method, _normalize_path(metric.path))].append(metric)
        api_quality = []
        for (method, path), metrics in grouped.items():
            durations = sorted(item.duration_ms for item in metrics)
            errors = [item for item in metrics if item.status_code >= 400]
            unauthorized = [item for item in metrics if item.status_code == 401]
            api_quality.append(
                {
                    "method": method,
                    "path": path,
                    "requests": len(metrics),
                    "errors": len(errors),
                    "error_rate": round(len(errors) / len(metrics) * 100, 2) if metrics else 0,
                    "p50_ms": _percentile(durations, 50),
                    "p95_ms": _percentile(durations, 95),
                    "unauthorized": len(unauthorized),
                }
            )
        api_quality.sort(key=lambda item: item["requests"], reverse=True)
        recent_errors = [
            {
                "method": item.method,
                "path": _normalize_path(item.path),
                "status_code": item.status_code,
                "error": item.error or _status_text(item.status_code),
                "created_at": _format_utc(item.created_at),
            }
            for item in list(REQUEST_METRICS)
            if item.status_code >= 400
        ][-20:]
        recent_errors.reverse()
        return {"api_quality": api_quality[:10], "recent_errors": recent_errors}

    def _ai_snapshot(self) -> dict[str, Any]:
        total = len(AI_METRICS)
        success = sum(1 for item in AI_METRICS if item.ok and not item.fallback)
        fallback = sum(1 for item in AI_METRICS if item.fallback)
        latencies = [item.duration_ms for item in AI_METRICS]
        warnings = [item for item in AI_METRICS if item.warning]
        reasons = Counter(_warning_reason(item.warning) for item in warnings)
        return {
            "total": total,
            "success": success,
            "success_rate": round(success / total * 100, 1) if total else 100,
            "fallback": fallback,
            "avg_latency_ms": round(sum(latencies) / len(latencies)) if latencies else 0,
            "latest_warning": warnings[-1].warning if warnings else "",
            "fallback_reasons": [{"reason": reason, "count": count} for reason, count in reasons.most_common()],
            "warnings": [
                {"message": item.warning, "created_at": _format_utc(item.created_at)}
                for item in list(warnings)[-10:][::-1]
            ],
        }

    def _content_snapshot(self, db: dict[str, Any]) -> dict[str, Any]:
        scene_counts = Counter(_attr(record, "scene") or "其他" for record in db["rows"]["reviews"])
        total = max(sum(scene_counts.values()), 1)
        business = db["business"]
        return {
            "top_scenes": [{"scene": scene, "count": count, "percent": round(count / total * 100, 1)} for scene, count in scene_counts.most_common(5)],
            "method_rate": round(business["methods"] / business["events"] * 100, 1) if business["events"] else 0,
            "calibration_rate": round(business["calibrations"] / business["anxiety"] * 100, 1) if business["anxiety"] else 0,
        }

    def _pending_snapshot(self, db: dict[str, Any]) -> dict[str, Any]:
        today = date.today()
        users_by_id = {user.get("id"): user.get("username") for user in db.get("users", []) if isinstance(user, dict)}
        overdue = []
        for card in db["rows"]["calibrations"]:
            verify_date = _date_value(_attr(card, "verification_date"))
            if (_attr(card, "status") or "pending") == "pending" and verify_date and (today - verify_date).days > 7:
                overdue.append({"title": _attr(card, "worry") or "未命名校准卡", "days": (today - verify_date).days})
        recent_records = sorted(db["rows"]["reviews"], key=lambda item: _datetime_value(_attr(item, "created_at")) or datetime.min, reverse=True)[:5]
        return {
            "overdue_calibrations": overdue[:5],
            "overdue_count": len(overdue),
            "recent_records": [
                {
                    "title": _attr(record, "title") or "未命名复盘",
                    "type": _attr(record, "type") or "event",
                    "scene": _attr(record, "scene") or "其他",
                    "user_id": _attr(record, "user_id") or "",
                    "username": users_by_id.get(_attr(record, "user_id")) or "",
                    "created_at": _format_monitor_datetime(_datetime_value(_attr(record, "created_at")) or datetime.utcnow()),
                    "updated_at": _format_monitor_datetime(_datetime_value(_attr(record, "updated_at")) or _datetime_value(_attr(record, "created_at")) or datetime.utcnow()),
                }
                for record in recent_records
            ],
        }


def _attr(item: Any, name: str) -> Any:
    return getattr(item, name, None)


def _user_payload(user: Any) -> dict[str, Any]:
    created_at = _datetime_value(_attr(user, "created_at"))
    return {
        "id": _attr(user, "id") or "",
        "username": _attr(user, "username") or "",
        "created_at": _format_utc(created_at) if created_at else "",
    }


def _format_utc(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat() + "Z"


def _format_monitor_datetime(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat()


def _date_value(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                return None
    return None


def _datetime_value(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _normalize_path(path: str) -> str:
    parts = [part for part in path.split("/") if part]
    normalized = []
    for part in parts:
        if len(part) > 12 and any(char.isdigit() for char in part):
            normalized.append("{id}")
        else:
            normalized.append(part)
    return "/" + "/".join(normalized)


def _percentile(values: list[int], percentile: int) -> int:
    if not values:
        return 0
    index = min(len(values) - 1, round((percentile / 100) * (len(values) - 1)))
    return values[index]


def _status_text(status_code: int) -> str:
    if status_code == 401:
        return "Unauthorized"
    if status_code == 404:
        return "Not Found"
    if status_code >= 500:
        return "Internal Server Error"
    return "Request Error"


def _warning_reason(warning: str) -> str:
    if "API Key" in warning:
        return "无 API Key"
    if "超时" in warning or "timed out" in warning:
        return "超时"
    if "JSON" in warning:
        return "JSON 解析失败"
    if "网络" in warning or "连接" in warning:
        return "网络错误"
    return "其他"


def _monitor_secret() -> str:
    config_secret = load_config().get("monitor", {}).get("secret_key")
    return os.getenv("MONITOR_SECRET") or config_secret or os.getenv("AUTH_SECRET") or _DEFAULT_MONITOR_SECRET


def _sign(payload_part: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload_part.encode("utf-8"), hashlib.sha256).hexdigest()


def _b64encode(value: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    import base64

    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))
