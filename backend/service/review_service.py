from __future__ import annotations

from datetime import date
from uuid import uuid4

from agent.review_prompt_builder import build_review_prompt
from backend.constant.review_constants import ANXIETY_TYPE, EVENT_TYPE
from backend.domain.models import CalibrationCard, MethodCard, ReviewBundle, ReviewRecord, UserContext
from backend.domain.req import CreateReviewRequest, UpdateNoteRequest
from backend.exceptions.business_exception import NotFoundException
from backend.mapper.review_mapper import ReviewMapper


class ReviewService:
    def __init__(self, mapper: ReviewMapper | None = None):
        self.mapper = mapper or ReviewMapper()

    def analyze(self, request: CreateReviewRequest, user: UserContext) -> ReviewBundle:
        build_review_prompt(request.type, request.raw_input, request.scene)
        bundle = self._mock_ai_bundle(request)
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
        return {"review_id": review_id, "note": request.note}

    def _mock_ai_bundle(self, request: CreateReviewRequest) -> ReviewBundle:
        today = date.today().isoformat()
        review_id = f"{request.type}-{uuid4().hex[:10]}"
        title = self._title_from_input(request.raw_input, request.type)

        if request.type == ANXIETY_TYPE:
            record = ReviewRecord(
                id=review_id,
                type=ANXIETY_TYPE,
                scene=request.scene or "面试",
                title=title,
                raw_input=request.raw_input,
                summary={
                    "焦虑触发点": "这次焦虑由一个尚未完全确定的结果触发，注意力被最坏情况吸引。",
                    "我担心的事情": request.raw_input,
                    "最坏剧本": "事情可能没有按预期发展，并被自己理解为能力不足或准备不够。",
                    "现实证据": "担心有一部分现实依据，但目前证据不足以证明最坏情况一定会发生。",
                    "可控部分": "把担心拆成 1 到 3 个可以准备或验证的小动作。",
                    "不可控部分": "他人的评价、具体提问、最终结果和偶然因素。",
                },
                deep_review={
                    "触发点": "想到不确定结果时，开始反复推演失败场景。",
                    "担心内容": "担心自己无法处理关键问题，进而影响结果。",
                    "证据检查": "支持证据是仍有不确定点；反对证据是可以继续准备，也并非所有结果都取决于单次表现。",
                    "概率校准": "焦虑时会把失败概率放大，复盘时先把概率改成区间判断。",
                    "可控行动": "列出一个 30 分钟内可以完成的准备动作，并完成它。",
                    "安顿策略": "完成最小准备动作后，暂停继续推演，把注意力拉回当下。",
                },
                result_card={
                    "核心担心": request.raw_input,
                    "现实检查": "这个担心有一定现实依据，但目前证据不足以说明最坏结果一定会发生。",
                    "最小可控行动": "准备一个最小行动清单，并在今天完成第一步。",
                    "需要放下的不可控部分": "他人评价、具体过程和最终结果。",
                    "下次提醒自己的话": "焦虑不是预测结果，它只是提醒我有事情需要准备。",
                },
                created_at=today,
                updated_at=today,
                saved_to_calibration=True,
            )
            calibration = CalibrationCard(
                id=f"calibration-{uuid4().hex[:8]}",
                source_review_id=review_id,
                worry=record.title,
                scene=record.scene,
                estimated_probability="80%",
                verification_date="2026-05-25",
                status="pending",
            )
            return ReviewBundle(record=record, calibration_card=calibration, warnings=["当前使用 mock AI 输出"])

        record = ReviewRecord(
            id=review_id,
            type=EVENT_TYPE,
            scene=request.scene or "工作",
            title=title,
            raw_input=request.raw_input,
            summary={
                "事件摘要": request.raw_input,
                "我的目标": "希望把事情推进顺利，并减少不必要的返工或内耗。",
                "实际结果": "结果没有完全达到预期，因此需要复盘原因。",
                "关键行为": "过程中存在一个可以提前确认、拆解或校验的关键动作。",
                "不满意点": "问题不只是粗心，而是开始前缺少更清晰的确认步骤。",
                "可能影响": "可能影响进度、协作效率或自己的稳定感。",
            },
            deep_review={
                "事实层": "实际发生的事情与预期存在偏差，需要先还原事实，不急着评价。",
                "行为层": "当时少做了一个提前确认、边界澄清或验收检查的动作。",
                "认知层": "默认自己已经理解了关键信息，但没有把这个理解拿出来校验。",
                "方法层": "需要沉淀一个开始前确认清单，把模糊点提前暴露出来。",
            },
            result_card={
                "问题提醒": "问题不只是粗心，而是开始前缺少关键确认。",
                "下次遇到类似情况，我会": "在正式行动前，先用 5 分钟确认目标、边界和验收标准。",
                "行动步骤": ["复述我对事情的理解", "确认目标和边界", "列出关键不确定点", "要一个可参考样例", "明确完成标准"],
                "一句提醒自己的话": "开始做之前，先确认清楚，返工的成本更高。",
            },
            created_at=today,
            updated_at=today,
            saved_to_method_library=True,
        )
        method = MethodCard(
            id=f"method-{uuid4().hex[:8]}",
            source_review_id=review_id,
            title="开始前确认卡",
            scenes=[record.scene, "复盘"],
            trigger="准备开始处理类似事情前",
            steps=["复述理解", "确认目标和边界", "列出不确定点", "确认样例和验收标准"],
            reminder="开始做之前，先确认清楚，返工的成本更高。",
            created_at=today,
            updated_at=today,
        )
        return ReviewBundle(record=record, method_card=method, warnings=["当前使用 mock AI 输出"])

    @staticmethod
    def _title_from_input(raw_input: str, review_type: str) -> str:
        clean = raw_input.replace("\n", " ").strip()
        if not clean:
            return "新的焦虑复盘" if review_type == ANXIETY_TYPE else "新的事件复盘"
        return clean[:22] + ("..." if len(clean) > 22 else "")
