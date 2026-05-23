from __future__ import annotations

from backend.domain.models import CalibrationCard, MethodCard, ReviewRecord


class MemoryReviewMapper:
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

    def update_note(self, review_id: str, note: str, user_id: str) -> None:
        record = self.get_review(review_id, user_id)
        if record is not None:
            record.note = note

    def delete_review(self, review_id: str, user_id: str) -> bool:
        self._ensure_seeded(user_id)
        deleted = self._reviews.get(user_id, {}).pop(review_id, None) is not None
        self._methods[user_id] = {
            card_id: card
            for card_id, card in self._methods.get(user_id, {}).items()
            if card.source_review_id != review_id
        }
        self._calibrations[user_id] = {
            card_id: card
            for card_id, card in self._calibrations.get(user_id, {}).items()
            if card.source_review_id != review_id
        }
        return deleted

    def delete_method(self, method_id: str, user_id: str) -> bool:
        self._ensure_seeded(user_id)
        return self._methods.get(user_id, {}).pop(method_id, None) is not None

    def delete_calibration(self, calibration_id: str, user_id: str) -> bool:
        self._ensure_seeded(user_id)
        return self._calibrations.get(user_id, {}).pop(calibration_id, None) is not None

    def _ensure_seeded(self, user_id: str) -> None:
        if user_id in self._reviews:
            return
        self._reviews[user_id] = {}
        self._methods[user_id] = {}
        self._calibrations[user_id] = {}
