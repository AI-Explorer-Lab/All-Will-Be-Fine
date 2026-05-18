from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


ReviewType = Literal["event", "anxiety"]


@dataclass
class UserContext:
    user_id: str
    nickname: str = "me"


@dataclass
class ReviewRecord:
    id: str
    type: ReviewType
    scene: str
    title: str
    raw_input: str
    summary: dict[str, Any]
    deep_review: dict[str, Any]
    result_card: dict[str, Any]
    created_at: str
    updated_at: str
    saved_to_method_library: bool = False
    saved_to_calibration: bool = False


@dataclass
class MethodCard:
    id: str
    source_review_id: str
    title: str
    scenes: list[str]
    trigger: str
    steps: list[str]
    reminder: str
    created_at: str
    updated_at: str


@dataclass
class CalibrationCard:
    id: str
    source_review_id: str
    worry: str
    scene: str
    estimated_probability: str
    verification_date: str
    status: Literal["pending", "verified"]
    final_result: str = ""
    actual_impact: str = ""
    calibration_conclusion: str = ""


@dataclass
class ReviewBundle:
    record: ReviewRecord
    method_card: MethodCard | None = None
    calibration_card: CalibrationCard | None = None
    warnings: list[str] = field(default_factory=list)
