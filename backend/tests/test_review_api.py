import os
import unittest
from uuid import uuid4

os.environ["DB_TYPE"] = "memory"

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

    def test_preview_analyze_does_not_persist_until_saved(self):
        preview_user = UserContext(user_id=f"api-preview-user-{uuid4().hex}")
        response = review_controller.analyze_review(
            {"type": "event", "scene": "工作", "raw_input": "先生成预览，再确认保存", "persist": False},
            user=preview_user,
        )

        self.assertTrue(response["success"])
        self.assertEqual(review_controller.list_reviews(user=preview_user)["data"], [])

        saved = review_controller.save_review_bundle(response["data"], user=preview_user)

        self.assertTrue(saved["success"])
        records = review_controller.list_reviews(user=preview_user)["data"]
        self.assertEqual(len(records), 1)
        self.assertNotIn("实际结果", records[0]["summary"])
        self.assertEqual(len(review_controller.list_methods(user=preview_user)["data"]), 1)

    def test_save_record_without_method_card_keeps_method_library_empty(self):
        user = UserContext(user_id=f"api-record-only-user-{uuid4().hex}")
        response = review_controller.analyze_review(
            {"type": "event", "scene": "工作", "raw_input": "只保存记录，不进入方法库", "persist": False},
            user=user,
        )
        payload = response["data"]
        payload["method_card"] = None
        payload["record"]["saved_to_method_library"] = False

        saved = review_controller.save_review_bundle(payload, user=user)

        self.assertTrue(saved["success"])
        self.assertEqual(len(review_controller.list_reviews(user=user)["data"]), 1)
        self.assertEqual(review_controller.list_methods(user=user)["data"], [])

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

    def test_update_review_method_and_calibration_persist(self):
        user = UserContext(user_id=f"api-update-user-{uuid4().hex}")
        event = review_controller.analyze_review(
            {"type": "event", "scene": "work", "raw_input": "initial event"},
            user=user,
        )
        review_id = event["data"]["record"]["id"]
        method_id = event["data"]["method_card"]["id"]

        review_controller.update_review(
            review_id,
            {
                **event["data"]["record"],
                "title": "updated review title",
                "raw_input": "updated raw input",
                "summary": {"发生了什么": "updated summary"},
                "result_card": {"下次怎么做": ["updated step"]},
            },
            user=user,
        )
        review_controller.update_method(
            method_id,
            {
                **event["data"]["method_card"],
                "title": "updated method title",
                "trigger": "updated trigger",
                "steps": ["updated method step"],
            },
            user=user,
        )

        anxiety = review_controller.analyze_review(
            {"type": "anxiety", "scene": "work", "raw_input": "initial worry"},
            user=user,
        )
        calibration_id = anxiety["data"]["calibration_card"]["id"]
        review_controller.update_calibration(
            calibration_id,
            {
                **anxiety["data"]["calibration_card"],
                "worry": "updated worry",
                "estimated_probability": "55%",
                "verification_date": "2026-05-30",
            },
            user=user,
        )

        records = review_controller.list_reviews(user=user)["data"]
        methods = review_controller.list_methods(user=user)["data"]
        calibrations = review_controller.list_calibrations(user=user)["data"]

        self.assertEqual(next(item for item in records if item["id"] == review_id)["title"], "updated review title")
        self.assertEqual(next(item for item in methods if item["id"] == method_id)["title"], "updated method title")
        self.assertEqual(next(item for item in calibrations if item["id"] == calibration_id)["worry"], "updated worry")

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
