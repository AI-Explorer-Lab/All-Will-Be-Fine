import os
import unittest

os.environ["DB_TYPE"] = "memory"

from backend.domain.models import UserContext
from backend.domain.req import CreateReviewRequest
from backend.service.review_service import ReviewService
from backend.service.slot_completion_service import build_fallback_follow_up, build_fallback_slots


class FakeSlotCompleter:
    def complete(self, request, prompt):
        return build_fallback_slots(request), []

    def follow_up(self, record, question="", stage="result"):
        return build_fallback_follow_up(record, question), []


class ReviewServiceTest(unittest.TestCase):
    def test_event_review_generates_method_card(self):
        service = ReviewService(slot_completer=FakeSlotCompleter())
        request = CreateReviewRequest(type="event", scene="工作", raw_input="接口沟通不清导致返工")
        bundle = service.analyze(request, UserContext(user_id="u1"))

        self.assertEqual(bundle.record.type, "event")
        self.assertTrue(bundle.record.saved_to_method_library)
        self.assertIsNotNone(bundle.method_card)
        self.assertIn("下次怎么做", bundle.record.result_card)
        self.assertIn("发生了什么", bundle.record.summary)
        self.assertIn("需要改进的地方", bundle.record.summary)
        self.assertNotIn("实际结果", bundle.record.summary)
        self.assertIn("接口沟通不清", bundle.record.summary["发生了什么"])

    def test_anxiety_review_generates_calibration_card(self):
        service = ReviewService(slot_completer=FakeSlotCompleter())
        request = CreateReviewRequest(type="anxiety", scene="面试", raw_input="担心面试技术问题答不上来")
        bundle = service.analyze(request, UserContext(user_id="u2"))

        self.assertEqual(bundle.record.type, "anxiety")
        self.assertTrue(bundle.record.saved_to_calibration)
        self.assertIsNotNone(bundle.calibration_card)
        self.assertIn("我在担心什么", bundle.record.summary)
        self.assertNotIn("可控部分", bundle.record.summary)
        self.assertIn("我能做什么", bundle.record.result_card)

    def test_ai_review_uses_all_user_provided_fields(self):
        service = ReviewService(slot_completer=FakeSlotCompleter())
        request = CreateReviewRequest(
            type="event",
            scene="工作",
            raw_input="发布前发现接口字段理解错了",
            provided_fields={
                "发生了什么": "发布前发现接口字段理解错了",
                "需要改进的地方": "开发前没有确认字段语义",
                "下次怎么做": "先复述需求\n再确认验收标准",
                "提醒自己": "先确认，再动手",
            },
        )

        bundle = service.analyze(request, UserContext(user_id="u3"))

        improvement = bundle.record.summary["需要改进的地方"]
        next_steps = bundle.record.result_card["下次怎么做"]
        self.assertEqual(improvement["user_content"], "开发前没有确认字段语义")
        self.assertIn("进一步明确", improvement["ai_suggestion"])
        self.assertEqual(next_steps["user_content"], ["先复述需求", "再确认验收标准"])
        self.assertIn("完成标准", next_steps["ai_suggestion"])
        self.assertEqual(bundle.method_card.steps, ["先复述需求", "再确认验收标准"])
        self.assertEqual(bundle.method_card.reminder, "先确认，再动手")
        self.assertEqual(bundle.method_card.trigger, "准备开始处理类似事情前")

    def test_ai_suggestion_does_not_replace_user_content(self):
        class SuggestionCompleter:
            def complete(self, request, prompt):
                slots = build_fallback_slots(request, apply_user_fields=False)
                slots["summary"]["需要改进的地方"] = "AI 擅自改写的结论"
                slots["ai_suggestions"]["需要改进的地方"] = "建议明确是哪一个验收标准没有提前确认。"
                from backend.service.slot_completion_service import apply_provided_fields

                return apply_provided_fields(slots, request.type, request.provided_fields), []

            def follow_up(self, record, question="", stage="result"):
                return build_fallback_follow_up(record, question), []

        service = ReviewService(slot_completer=SuggestionCompleter())
        request = CreateReviewRequest(
            type="event",
            scene="工作",
            raw_input="接口返工",
            provided_fields={"需要改进的地方": "沟通不够清楚"},
        )

        bundle = service.analyze(request, UserContext(user_id="u5"))
        field = bundle.record.summary["需要改进的地方"]

        self.assertEqual(field["user_content"], "沟通不够清楚")
        self.assertEqual(field["ai_suggestion"], "建议明确是哪一个验收标准没有提前确认。")
        self.assertNotIn("AI 擅自改写", str(field))

    def test_generated_tags_are_limited_to_scene_whitelist(self):
        class InvalidTagCompleter:
            def complete(self, request, prompt):
                slots = build_fallback_slots(request)
                slots["scene"] = "需求沟通"
                slots["method_card"]["scenes"] = ["开发", "需求沟通"]
                return slots, []

            def follow_up(self, record, question="", stage="result"):
                return build_fallback_follow_up(record, question), []

        service = ReviewService(slot_completer=InvalidTagCompleter())
        request = CreateReviewRequest(type="event", scene="工作", raw_input="接口理解错误")

        bundle = service.analyze(request, UserContext(user_id="u4"))

        self.assertEqual(bundle.record.scene, "工作")
        self.assertEqual(bundle.method_card.scenes, ["其他"])


if __name__ == "__main__":
    unittest.main()
