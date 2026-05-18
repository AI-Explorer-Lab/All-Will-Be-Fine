from __future__ import annotations

from backend.domain.models import CalibrationCard, MethodCard, ReviewRecord


class ReviewMapper:
    _reviews: dict[str, dict[str, ReviewRecord]] = {}
    _methods: dict[str, dict[str, MethodCard]] = {}
    _calibrations: dict[str, dict[str, CalibrationCard]] = {}

    def save_review(self, record: ReviewRecord, user_id: str) -> ReviewRecord:
        self._ensure_seeded(user_id)
        self._reviews.setdefault(user_id, {})[record.id] = record
        return record

    def get_review(self, review_id: str, user_id: str) -> ReviewRecord | None:
        self._ensure_seeded(user_id)
        return self._reviews.get(user_id, {}).get(review_id)

    def list_reviews(self, user_id: str) -> list[ReviewRecord]:
        self._ensure_seeded(user_id)
        return list(self._reviews.get(user_id, {}).values())

    def save_method(self, card: MethodCard, user_id: str) -> MethodCard:
        self._ensure_seeded(user_id)
        self._methods.setdefault(user_id, {})[card.id] = card
        return card

    def list_methods(self, user_id: str) -> list[MethodCard]:
        self._ensure_seeded(user_id)
        return list(self._methods.get(user_id, {}).values())

    def save_calibration(self, card: CalibrationCard, user_id: str) -> CalibrationCard:
        self._ensure_seeded(user_id)
        self._calibrations.setdefault(user_id, {})[card.id] = card
        return card

    def list_calibrations(self, user_id: str) -> list[CalibrationCard]:
        self._ensure_seeded(user_id)
        return list(self._calibrations.get(user_id, {}).values())

    def _ensure_seeded(self, user_id: str) -> None:
        if user_id in self._reviews:
            return

        self._reviews[user_id] = {
            "r1": ReviewRecord(
                id="r1",
                type="event",
                scene="工作",
                title="接口需求沟通不清导致返工",
                raw_input="在与后端沟通接口需求时，对字段含义和返回规则理解不一致，导致开发完成后发现问题，需要返工修改。",
                summary={
                    "事件摘要": "在与后端沟通接口需求时，对字段含义和返回规则理解不一致，导致开发完成后发现问题，需要返工修改。",
                    "我的目标": "按时完成接口开发并保证联调顺利通过。",
                    "实际结果": "返工修改，延误了进度。",
                    "关键行为": "沟通时没有确认关键字段含义和验收标准。",
                    "不满意点": "没有在开始开发前把模糊点问清楚。",
                    "可能影响": "进度延迟，协作效率下降。",
                },
                deep_review={
                    "事实层": "接口字段理解出现偏差，开发完成后才发现双方对字段含义理解不一致。",
                    "行为层": "开始开发前没有主动确认字段含义、边界情况和验收样例。",
                    "认知层": "默认自己理解的字段含义就是对方真实想表达的含义。",
                    "方法层": "缺少一个开发前需求确认清单，尤其是字段含义、异常情况和验收标准的确认流程。",
                },
                result_card={
                    "问题提醒": "问题不只是粗心，而是开始前缺少字段含义和验收标准的确认。",
                    "下次遇到类似情况，我会": "在正式开发前，先用 5 分钟确认需求关键点。",
                    "行动步骤": ["先复述我对需求的理解", "确认目标和边界", "确认关键字段含义", "要一个正常样例和异常样例", "明确验收标准"],
                    "一句提醒自己的话": "开始做之前，先确认清楚，返工的成本更高。",
                },
                created_at="2026-05-17",
                updated_at="2026-05-17",
                saved_to_method_library=True,
            ),
            "r2": ReviewRecord(
                id="r2",
                type="anxiety",
                scene="面试",
                title="担心面试技术问题答不上来",
                raw_input="想到即将到来的面试，担心技术问题答不上来，也担心被问到自己不熟悉的大模型或 Agent 问题。",
                summary={
                    "焦虑触发点": "想到即将到来的面试，担心技术问题答不上来。",
                    "我担心的事情": "担心被问到自己不熟悉的大模型或 Agent 问题。",
                    "最坏剧本": "面试表现很差，被面试官认为能力不足。",
                    "现实证据": "确实存在部分知识点还不熟，但也已经准备了多个项目和常见问题。",
                    "可控部分": "继续准备高频问题，整理项目话术，练习结构化表达。",
                    "不可控部分": "面试官具体问什么、对方评价标准、最终结果。",
                },
                deep_review={
                    "触发点": "想到即将进行的面试，开始反复推演失败场景。",
                    "担心内容": "担心被问到完全不会的问题，导致面试失败。",
                    "证据检查": "支持证据是仍有部分知识点不熟；反对证据是已经有项目经验，也准备过多个常见问题。",
                    "概率校准": "焦虑时可能把失败概率估计为 80%，但实际更合理的判断可能是 40% 到 50%。",
                    "可控行动": "继续准备技术选型、大模型基础、Agent 编排、项目链路等高频问题。",
                    "安顿策略": "把焦虑转化为 30 分钟的具体准备任务，完成后停止反复推演最坏结果。",
                },
                result_card={
                    "核心担心": "担心面试中被问到不会的问题，从而被认为能力不足。",
                    "现实检查": "这个担心有一定现实依据，但目前证据不足以说明最坏结果一定会发生。",
                    "最小可控行动": "准备 5 个高频技术问题，并练习用结构化方式回答。",
                    "需要放下的不可控部分": "面试官具体问什么、对方主观评价、最终结果。",
                    "下次提醒自己的话": "焦虑不是预测结果，它只是提醒我有事情需要准备。",
                },
                created_at="2026-05-16",
                updated_at="2026-05-16",
                saved_to_calibration=True,
            ),
            "r3": ReviewRecord(
                id="r3",
                type="event",
                scene="学习",
                title="学习计划执行不下去",
                raw_input="计划太大太模糊，缺少具体执行步骤和反馈机制。",
                summary={"事件摘要": "学习目标过大，执行动作不够具体。"},
                deep_review={"方法层": "缺少把目标拆成 30 分钟动作的执行清单。"},
                result_card={"一句提醒自己的话": "先把任务缩小到今天能完成的一步。"},
                created_at="2026-05-15",
                updated_at="2026-05-15",
            ),
        }

        self._methods[user_id] = {
            "m1": MethodCard(
                id="m1",
                source_review_id="r1",
                title="开发前需求确认卡",
                scenes=["工作", "开发", "需求沟通"],
                trigger="准备开始写接口或修改逻辑前",
                steps=["复述我对需求的理解", "确认目标和边界", "确认关键字段含义", "要一个正常样例和异常样例", "明确验收标准"],
                reminder="开始做之前，先确认清楚，返工的成本更高。",
                created_at="2026-05-17",
                updated_at="2026-05-17",
            )
        }

        self._calibrations[user_id] = {
            "c1": CalibrationCard(
                id="c1",
                source_review_id="r2",
                worry="担心面试技术问题答不上来",
                scene="面试",
                estimated_probability="80%",
                verification_date="2026-05-25",
                status="pending",
            ),
            "c2": CalibrationCard(
                id="c2",
                source_review_id="r2",
                worry="担心面试一定表现很差",
                scene="面试",
                estimated_probability="80%",
                verification_date="2026-05-12",
                status="verified",
                final_result="部分发生，但没有想象中严重",
                actual_impact="中等",
                calibration_conclusion="当时高估了失败概率，也高估了失败后果。下次应把焦虑转化为具体准备任务，而不是反复推演最坏结果。",
            ),
        }
