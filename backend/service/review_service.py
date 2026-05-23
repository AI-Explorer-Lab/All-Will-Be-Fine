from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from agent.review_prompt_builder import build_review_prompt
from backend.constant.review_constants import ANXIETY_TYPE, EVENT_TYPE
from backend.domain.models import CalibrationCard, MethodCard, ReviewBundle, ReviewRecord, UserContext
from backend.domain.req import CreateReviewRequest, FollowUpRequest, UpdateNoteRequest
from backend.exceptions.business_exception import NotFoundException
from backend.mapper.review_mapper import ReviewMapper
from backend.service.slot_completion_service import SlotCompletionService, title_from_input


class ReviewService:
    def __init__(self, mapper: ReviewMapper | None = None, slot_completer: SlotCompletionService | None = None):
        self.mapper = mapper or ReviewMapper()
        self.slot_completer = slot_completer or SlotCompletionService()

    def analyze(self, request: CreateReviewRequest, user: UserContext) -> ReviewBundle:
        prompt = build_review_prompt(request.type, request.raw_input, request.scene)
        slots, warnings = self.slot_completer.complete(request, prompt)
        bundle = self._bundle_from_slots(request, slots, warnings)
        self.mapper.save_review(bundle.record, user.user_id)
        if bundle.method_card:
            self.mapper.save_method(bundle.method_card, user.user_id)
        if bundle.calibration_card:
            self.mapper.save_calibration(bundle.calibration_card, user.user_id)
        return bundle

    def list_records(self, user: UserContext) -> list[ReviewRecord]:
        return self.mapper.list_reviews(user.user_id)

    def get_record(self, review_id: str, user: UserContext) -> ReviewRecord:
        record = self.mapper.get_review(review_id, user.user_id)
        if record is None:
            raise NotFoundException("复盘记录不存在")
        return record

    def list_methods(self, user: UserContext) -> list[MethodCard]:
        return self.mapper.list_methods(user.user_id)

    def list_calibrations(self, user: UserContext) -> list[CalibrationCard]:
        return self.mapper.list_calibrations(user.user_id)

    def update_note(self, review_id: str, request: UpdateNoteRequest, user: UserContext) -> dict[str, str]:
        if self.mapper.get_review(review_id, user.user_id) is None:
            raise NotFoundException("复盘记录不存在")
        self.mapper.update_note(review_id, request.note, user.user_id)
        return {"review_id": review_id, "note": request.note}

    def follow_up(self, review_id: str, request: FollowUpRequest, user: UserContext) -> dict:
        record = self.get_record(review_id, user)
        result, warnings = self.slot_completer.follow_up(record, request.question, request.stage)
        return {"review_id": review_id, "follow_up": result, "warnings": warnings}

    def delete_record(self, review_id: str, user: UserContext) -> dict[str, str]:
        if not self.mapper.delete_review(review_id, user.user_id):
            raise NotFoundException("复盘记录不存在")
        return {"review_id": review_id}

    def delete_method(self, method_id: str, user: UserContext) -> dict[str, str]:
        if not self.mapper.delete_method(method_id, user.user_id):
            raise NotFoundException("方法卡不存在")
        return {"method_id": method_id}

    def delete_calibration(self, calibration_id: str, user: UserContext) -> dict[str, str]:
        if not self.mapper.delete_calibration(calibration_id, user.user_id):
            raise NotFoundException("校准卡不存在")
        return {"calibration_id": calibration_id}

    def _bundle_from_slots(self, request: CreateReviewRequest, slots: dict, warnings: list[str] | None = None) -> ReviewBundle:
        now = _now_iso()
        review_id = f"{request.type}-{uuid4().hex[:10]}"
        title = slots.get("title") or title_from_input(request.raw_input, request.type)
        scene = request.scene or slots.get("scene") or ("面试" if request.type == ANXIETY_TYPE else "工作")

        if request.type == ANXIETY_TYPE:
            record = ReviewRecord(
                id=review_id,
                type=ANXIETY_TYPE,
                scene=scene,
                title=title,
                raw_input=request.raw_input,
                summary=slots.get("summary") or {},
                deep_review=slots.get("deep_review") or {},
                result_card=slots.get("result_card") or {},
                created_at=now,
                updated_at=now,
                saved_to_calibration=True,
            )
            calibration_slots = slots.get("calibration_card") or {}
            calibration = CalibrationCard(
                id=f"calibration-{uuid4().hex[:8]}",
                source_review_id=review_id,
                worry=calibration_slots.get("worry") or record.title,
                scene=record.scene,
                estimated_probability=calibration_slots.get("estimated_probability") or "80%",
                verification_date=calibration_slots.get("verification_date") or "",
                status="pending",
            )
            return ReviewBundle(record=record, calibration_card=calibration, warnings=warnings or [])

        record = ReviewRecord(
            id=review_id,
            type=EVENT_TYPE,
            scene=scene,
            title=title,
            raw_input=request.raw_input,
            summary=slots.get("summary") or {},
            deep_review=slots.get("deep_review") or {},
            result_card=slots.get("result_card") or {},
            created_at=now,
            updated_at=now,
            saved_to_method_library=True,
        )
        method_slots = slots.get("method_card") or {}
        method = MethodCard(
            id=f"method-{uuid4().hex[:8]}",
            source_review_id=review_id,
            title=method_slots.get("title") or "开始前确认卡",
            scenes=_as_list(method_slots.get("scenes")) or [record.scene, "复盘"],
            trigger=method_slots.get("trigger") or "准备开始处理类似事情前",
            steps=_as_list(method_slots.get("steps")) or ["复述理解", "确认目标和边界", "列出不确定点", "确认样例和验收标准"],
            reminder=method_slots.get("reminder") or "开始做之前，先确认清楚，返工的成本更高。",
            created_at=now,
            updated_at=now,
        )
        return ReviewBundle(record=record, method_card=method, warnings=warnings or [])


def _now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def _as_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.replace("，", "\n").replace("、", "\n").splitlines() if item.strip()]
    return []
