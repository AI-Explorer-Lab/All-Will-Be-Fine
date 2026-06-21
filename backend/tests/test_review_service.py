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

        self.assertEqual(bundle.record.summary["需要改进的地方"], "开发前没有确认字段语义")
        self.assertEqual(bundle.record.result_card["下次怎么做"], ["先复述需求", "再确认验收标准"])
        self.assertEqual(bundle.method_card.steps, ["先复述需求", "再确认验收标准"])
        self.assertEqual(bundle.method_card.reminder, "先确认，再动手")

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
