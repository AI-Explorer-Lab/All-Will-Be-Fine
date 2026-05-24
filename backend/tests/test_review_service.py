import unittest

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


if __name__ == "__main__":
    unittest.main()
