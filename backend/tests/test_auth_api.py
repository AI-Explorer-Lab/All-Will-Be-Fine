import os
import unittest
from uuid import uuid4

os.environ["DB_TYPE"] = "memory"

from backend.controller.APIs import auth_controller, review_controller
from backend.exceptions.business_exception import AuthenticationException, ConflictException, NotFoundException
from backend.middlewares.auth_dependency import get_current_user
from backend.service.review_service import ReviewService
from backend.service.slot_completion_service import build_fallback_follow_up, build_fallback_slots


class FakeSlotCompleter:
    def complete(self, request, prompt):
        return build_fallback_slots(request), []

    def follow_up(self, record, question="", stage="result"):
        return build_fallback_follow_up(record, question), []


class AuthApiBoundaryTest(unittest.TestCase):
    def setUp(self):
        review_controller.service = ReviewService(slot_completer=FakeSlotCompleter())

    def _register(self, username: str):
        response = auth_controller.register(
            {"username": username, "password": "Passw0rd123"}
        )
        self.assertTrue(response["success"])
        self.assertNotIn("password", str(response["data"]).lower())
        self.assertNotIn("pbkdf2", str(response["data"]).lower())
        return response["data"]

    def test_review_dependency_requires_login(self):
        with self.assertRaises(AuthenticationException):
            get_current_user(None)

    def test_register_login_and_user_data_isolation(self):
        suffix = uuid4().hex[:8]
        alice_auth = self._register(f"alice-{suffix}")
        bob_auth = self._register(f"bob-{suffix}")
        alice_user = get_current_user(f"Bearer {alice_auth['access_token']}")
        bob_user = get_current_user(f"Bearer {bob_auth['access_token']}")

        login_response = auth_controller.login({"username": f"alice-{suffix}", "password": "Passw0rd123"})
        self.assertTrue(login_response["data"]["access_token"])

        review_controller.analyze_review(
            {"type": "event", "scene": "工作", "raw_input": "只属于 Alice 的复盘"},
            user=alice_user,
        )

        alice_records = review_controller.list_reviews(user=alice_user)["data"]
        bob_records = review_controller.list_reviews(user=bob_user)["data"]

        self.assertEqual(len(alice_records), 1)
        self.assertEqual(bob_records, [])

        with self.assertRaises(NotFoundException):
            review_controller.get_review(alice_records[0]["id"], user=bob_user)

    def test_duplicate_user_and_wrong_password_are_rejected(self):
        username = f"user-{uuid4().hex[:8]}"
        self._register(username)

        with self.assertRaises(ConflictException):
            auth_controller.register({"username": username, "password": "Passw0rd123"})

        with self.assertRaises(AuthenticationException):
            auth_controller.login({"username": username, "password": "wrong-password"})


if __name__ == "__main__":
    unittest.main()
