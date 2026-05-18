import unittest

from backend.controller.APIs import review_controller
from backend.domain.models import UserContext


class ReviewApiBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.user = UserContext(user_id="api-test-user")

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

    def test_method_and_calibration_lists_are_seeded(self):
        methods = review_controller.list_methods(user=self.user)
        calibrations = review_controller.list_calibrations(user=self.user)

        self.assertTrue(methods["success"])
        self.assertTrue(calibrations["success"])
        self.assertGreaterEqual(len(methods["data"]), 1)
        self.assertGreaterEqual(len(calibrations["data"]), 1)


if __name__ == "__main__":
    unittest.main()
