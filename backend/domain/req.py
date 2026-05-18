from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.constant.review_constants import ANXIETY_TYPE, EVENT_TYPE, REVIEW_TYPES
from backend.exceptions.business_exception import ValidationException


@dataclass
class CreateReviewRequest:
    type: str
    raw_input: str
    scene: str | None = None

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "CreateReviewRequest":
        review_type = payload.get("type", EVENT_TYPE)
        raw_input = (payload.get("raw_input") or payload.get("rawInput") or "").strip()
        scene = payload.get("scene")
        if review_type not in REVIEW_TYPES:
            raise ValidationException("复盘类型只支持 event 或 anxiety")
        if not raw_input:
            raise ValidationException("复盘内容不能为空")
        return cls(type=review_type, raw_input=raw_input, scene=scene)


@dataclass
class UpdateNoteRequest:
    note: str

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "UpdateNoteRequest":
        return cls(note=(payload.get("note") or "").strip())
