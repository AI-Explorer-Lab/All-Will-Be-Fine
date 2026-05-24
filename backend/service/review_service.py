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
        if not request.persist:
            return bundle
        return self.save_bundle(bundle, user)

    def save_bundle(self, bundle: ReviewBundle, user: UserContext) -> ReviewBundle:
        _compact_record_fields(bundle.record)
        self.mapper.save_review(bundle.record, user.user_id)
        if bundle.method_card:
            self.mapper.save_method(bundle.method_card, user.user_id)
        if bundle.calibration_card:
            self.mapper.save_calibration(bundle.calibration_card, user.user_id)
        return bundle

    def save_bundle_payload(self, payload: dict, user: UserContext) -> ReviewBundle:
        bundle = _bundle_from_payload(payload)
        return self.save_bundle(bundle, user)

    def list_records(self, user: UserContext) -> list[ReviewRecord]:
        records = self.mapper.list_reviews(user.user_id)
        for record in records:
            _compact_record_fields(record)
            self.mapper.save_review(record, user.user_id)
        return records

    def get_record(self, review_id: str, user: UserContext) -> ReviewRecord:
        record = self.mapper.get_review(review_id, user.user_id)
        if record is None:
            raise NotFoundException("复盘记录不存在")
        _compact_record_fields(record)
        self.mapper.save_review(record, user.user_id)
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


COMPACT_RECORD_FIELDS = {
    EVENT_TYPE: {
        "summary": ["发生了什么", "需要改进的地方", "下次怎么做", "提醒自己"],
        "result_card": ["需要改进的地方", "下次怎么做", "提醒自己"],
    },
    ANXIETY_TYPE: {
        "summary": ["我在担心什么", "现实检查", "我能做什么", "提醒自己"],
        "result_card": ["我能做什么", "提醒自己"],
    },
}

FIELD_ALIASES = {
    "发生了什么": ["发生了什么", "事件摘要"],
    "需要改进的地方": ["需要改进的地方", "不满意点", "问题提醒"],
    "下次怎么做": ["下次怎么做", "行动步骤", "下次遇到类似情况，我会", "我能做什么"],
    "提醒自己": ["提醒自己", "一句提醒自己的话", "下次提醒自己的话"],
    "我在担心什么": ["我在担心什么", "我担心的事情", "核心担心", "焦虑触发点"],
    "现实检查": ["现实检查", "现实证据", "证据检查"],
    "我能做什么": ["我能做什么", "最小可控行动", "可控行动", "可控部分"],
}


def _compact_record_fields(record: ReviewRecord) -> bool:
    original = (dict(record.summary), dict(record.result_card))
    fields = COMPACT_RECORD_FIELDS.get(record.type, COMPACT_RECORD_FIELDS[EVENT_TYPE])
    record.summary = _select_mapping(record.summary, fields["summary"])
    record.result_card = _select_mapping(record.result_card, fields["result_card"])
    return original != (record.summary, record.result_card)


def _select_mapping(mapping: dict, preferred_keys: list[str]) -> dict:
    if not mapping:
        return {}
    selected = {}
    for preferred_key in preferred_keys:
        found_key = _find_mapping_key(mapping, preferred_key)
        if found_key and preferred_key not in selected:
            selected[preferred_key] = mapping[found_key]
    return selected


def _find_mapping_key(mapping: dict, preferred_key: str) -> str | None:
    candidates = FIELD_ALIASES.get(preferred_key, [preferred_key])
    for candidate in candidates:
        if candidate in mapping:
            return candidate
    for candidate in candidates:
        for key in mapping:
            if candidate in str(key):
                return key
    return None


def _bundle_from_payload(payload: dict) -> ReviewBundle:
    record_payload = payload.get("record") or {}
    record = ReviewRecord(
        id=record_payload["id"],
        type=record_payload.get("type", EVENT_TYPE),
        scene=record_payload.get("scene") or "",
        title=record_payload.get("title") or "",
        raw_input=record_payload.get("raw_input") or record_payload.get("rawInput") or "",
        summary=record_payload.get("summary") or {},
        result_card=record_payload.get("result_card") or record_payload.get("resultCard") or {},
        created_at=record_payload.get("created_at") or record_payload.get("createdAt") or _now_iso(),
        updated_at=record_payload.get("updated_at") or record_payload.get("updatedAt") or _now_iso(),
        note=record_payload.get("note") or "",
        saved_to_method_library=bool(record_payload.get("saved_to_method_library") or record_payload.get("savedToMethodLibrary")),
        saved_to_calibration=bool(record_payload.get("saved_to_calibration") or record_payload.get("savedToCalibration")),
    )

    method_payload = payload.get("method_card") or payload.get("methodCard")
    method = None
    if method_payload:
        method = MethodCard(
            id=method_payload["id"],
            source_review_id=method_payload.get("source_review_id") or method_payload.get("sourceReviewId") or record.id,
            title=method_payload.get("title") or "",
            scenes=_as_list(method_payload.get("scenes")),
            trigger=method_payload.get("trigger") or "",
            steps=_as_list(method_payload.get("steps")),
            reminder=method_payload.get("reminder") or "",
            created_at=method_payload.get("created_at") or method_payload.get("createdAt") or _now_iso(),
            updated_at=method_payload.get("updated_at") or method_payload.get("updatedAt") or _now_iso(),
        )

    calibration_payload = payload.get("calibration_card") or payload.get("calibrationCard")
    calibration = None
    if calibration_payload:
        calibration = CalibrationCard(
            id=calibration_payload["id"],
            source_review_id=calibration_payload.get("source_review_id") or calibration_payload.get("sourceReviewId") or record.id,
            worry=calibration_payload.get("worry") or "",
            scene=calibration_payload.get("scene") or record.scene,
            estimated_probability=calibration_payload.get("estimated_probability") or calibration_payload.get("estimatedProbability") or "",
            verification_date=calibration_payload.get("verification_date") or calibration_payload.get("verificationDate") or "",
            status=calibration_payload.get("status") or "pending",
            final_result=calibration_payload.get("final_result") or calibration_payload.get("finalResult") or "",
            actual_impact=calibration_payload.get("actual_impact") or calibration_payload.get("actualImpact") or "",
            calibration_conclusion=calibration_payload.get("calibration_conclusion") or calibration_payload.get("calibrationConclusion") or "",
        )

    return ReviewBundle(
        record=record,
        method_card=method,
        calibration_card=calibration,
        warnings=payload.get("warnings") or [],
    )
