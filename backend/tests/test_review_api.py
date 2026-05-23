import unittest

from backend.controller.APIs import review_controller
from backend.domain.models import UserContext
from backend.service.review_service import ReviewService
from backend.service.slot_completion_service import build_fallback_follow_up, build_fallback_slots


class FakeSlotCompleter:
    def complete(self, request, prompt):
        return build_fallback_slots(request), []

    def follow_up(self, record, question="", stage="result"):
        return build_fallback_follow_up(record, question), []


class ReviewApiBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.user = UserContext(user_id="api-test-user")
        review_controller.service = ReviewService(slot_completer=FakeSlotCompleter())

    def test_analyze_review_and_list_records(self):
        response = review_controller.analyze_review(
            {"type": "event", "scene": "工作", "raw_input": "今天接口沟通不清，导致返工"},
            user=self.user,
        )

        self.assertTrue(response["success"])
        self.assertEqual(response["data"]["record"]["type"], "event")

        records_response = review_controller.list_reviews(user=self.user)
        self.assertTrue(records_response["success"])
        self.assertGreaterEqual(len(records_response["data"]), 1)

    def test_empty_user_lists_start_empty(self):
        empty_user = UserContext(user_id="api-empty-user")
        methods = review_controller.list_methods(user=empty_user)
        calibrations = review_controller.list_calibrations(user=empty_user)
        records = review_controller.list_reviews(user=empty_user)

        self.assertTrue(methods["success"])
        self.assertTrue(calibrations["success"])
        self.assertTrue(records["success"])
        self.assertEqual(methods["data"], [])
        self.assertEqual(calibrations["data"], [])
        self.assertEqual(records["data"], [])

    def test_delete_review_method_and_calibration(self):
        delete_user = UserContext(user_id="api-delete-user")
        event = review_controller.analyze_review(
            {"type": "event", "scene": "工作", "raw_input": "需要删除的事件复盘"},
            user=delete_user,
        )
        method_id = event["data"]["method_card"]["id"]
        method_response = review_controller.delete_method(method_id, user=delete_user)
        self.assertTrue(method_response["success"])
        self.assertNotIn(method_id, [item["id"] for item in review_controller.list_methods(user=delete_user)["data"]])

        anxiety = review_controller.analyze_review(
            {"type": "anxiety", "scene": "面试", "raw_input": "需要删除的焦虑校准"},
            user=delete_user,
        )
        calibration_id = anxiety["data"]["calibration_card"]["id"]
        calibration_response = review_controller.delete_calibration(calibration_id, user=delete_user)
        self.assertTrue(calibration_response["success"])
        self.assertNotIn(
            calibration_id,
            [item["id"] for item in review_controller.list_calibrations(user=delete_user)["data"]],
        )

        review_id = event["data"]["record"]["id"]
        review_response = review_controller.delete_review(review_id, user=delete_user)
        self.assertTrue(review_response["success"])
        self.assertNotIn(review_id, [item["id"] for item in review_controller.list_reviews(user=delete_user)["data"]])

    def test_follow_up_review_returns_question(self):
        follow_user = UserContext(user_id="api-follow-user")
        event = review_controller.analyze_review(
            {"type": "event", "scene": "工作", "raw_input": "需求确认不清导致返工"},
            user=follow_user,
        )
        review_id = event["data"]["record"]["id"]

        response = review_controller.follow_up_review(review_id, {"stage": "result"}, user=follow_user)

        self.assertTrue(response["success"])
        self.assertEqual(response["data"]["review_id"], review_id)
        self.assertIn("question", response["data"]["follow_up"])


if __name__ == "__main__":
    unittest.main()
