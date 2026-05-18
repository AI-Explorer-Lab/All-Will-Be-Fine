from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any


def success(data: Any = None, message: str = "ok") -> dict[str, Any]:
    return {"success": True, "message": message, "data": serialize(data)}


def fail(message: str, code: str = "BUSINESS_ERROR") -> dict[str, Any]:
    return {"success": False, "message": message, "code": code}


def serialize(data: Any) -> Any:
    if is_dataclass(data):
        return asdict(data)
    if isinstance(data, list):
        return [serialize(item) for item in data]
    if isinstance(data, dict):
        return {key: serialize(value) for key, value in data.items()}
    return data
