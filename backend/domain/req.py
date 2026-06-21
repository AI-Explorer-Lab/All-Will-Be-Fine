from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from backend.constant.review_constants import EVENT_TYPE, REVIEW_TYPES, normalize_scene
from backend.exceptions.business_exception import ValidationException


@dataclass
class CreateReviewRequest:
    type: str
    raw_input: str
    scene: str | None = None
    persist: bool = True
    provided_fields: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "CreateReviewRequest":
        review_type = payload.get("type", EVENT_TYPE)
        raw_input = (payload.get("raw_input") or payload.get("rawInput") or "").strip()
        scene = normalize_scene(payload.get("scene"), review_type)
        provided_fields = payload.get("provided_fields") or payload.get("providedFields") or {}
        if not isinstance(provided_fields, dict):
            provided_fields = {}
        if review_type not in REVIEW_TYPES:
            raise ValidationException("复盘类型只支持 event 或 anxiety")
        if not raw_input:
            raise ValidationException("复盘内容不能为空")
        persist = bool(payload.get("persist", True))
        return cls(
            type=review_type,
            raw_input=raw_input,
            scene=scene,
            persist=persist,
            provided_fields=provided_fields,
        )


@dataclass
class UpdateNoteRequest:
    note: str

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "UpdateNoteRequest":
        return cls(note=(payload.get("note") or "").strip())


@dataclass
class FollowUpRequest:
    question: str = ""
    stage: str = "result"

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "FollowUpRequest":
        return cls(
            question=(payload.get("question") or "").strip(),
            stage=(payload.get("stage") or "result").strip(),
        )
