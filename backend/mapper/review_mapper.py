from __future__ import annotations

from datetime import date, datetime, time
from typing import Any

from sqlalchemy.orm import sessionmaker

from backend.database.init_db import init_database
from backend.database.models import (
    CalibrationCardEntity,
    MethodCardEntity,
    ReviewEntity,
    UserEntity,
)
from backend.database.session import create_session_factory, get_db_type
from backend.domain.models import CalibrationCard, MethodCard, ReviewRecord
from backend.mapper.memory_review_mapper import MemoryReviewMapper


class ReviewMapper:
    def __init__(self):
        if get_db_type() == "postgres":
            self._impl = PostgresReviewMapper()
        else:
            self._impl = MemoryReviewMapper()

    def save_review(self, record: ReviewRecord, user_id: str) -> ReviewRecord:
        return self._impl.save_review(record, user_id)

    def get_review(self, review_id: str, user_id: str) -> ReviewRecord | None:
        return self._impl.get_review(review_id, user_id)

    def list_reviews(self, user_id: str) -> list[ReviewRecord]:
        return self._impl.list_reviews(user_id)

    def save_method(self, card: MethodCard, user_id: str) -> MethodCard:
        return self._impl.save_method(card, user_id)

    def list_methods(self, user_id: str) -> list[MethodCard]:
        return self._impl.list_methods(user_id)

    def save_calibration(self, card: CalibrationCard, user_id: str) -> CalibrationCard:
        return self._impl.save_calibration(card, user_id)

    def list_calibrations(self, user_id: str) -> list[CalibrationCard]:
        return self._impl.list_calibrations(user_id)

    def update_note(self, review_id: str, note: str, user_id: str) -> None:
        self._impl.update_note(review_id, note, user_id)

    def delete_review(self, review_id: str, user_id: str) -> bool:
        return self._impl.delete_review(review_id, user_id)

    def delete_method(self, method_id: str, user_id: str) -> bool:
        return self._impl.delete_method(method_id, user_id)

    def delete_calibration(self, calibration_id: str, user_id: str) -> bool:
        return self._impl.delete_calibration(calibration_id, user_id)


class PostgresReviewMapper:
    def __init__(self, session_factory: sessionmaker | None = None):
        init_database()
        self.session_factory = session_factory or create_session_factory()

    def save_review(self, record: ReviewRecord, user_id: str) -> ReviewRecord:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entity = session.get(ReviewEntity, record.id)
            if entity is None:
                entity = ReviewEntity(id=record.id, user_id=user_id)
                session.add(entity)
            entity.type = record.type
            entity.scene = record.scene
            entity.title = record.title
            entity.raw_input = record.raw_input
            entity.summary_json = record.summary
            entity.deep_review_json = {}
            entity.result_card_json = record.result_card
            entity.note = getattr(record, "note", "")
            entity.saved_to_method_library = record.saved_to_method_library
            entity.saved_to_calibration = record.saved_to_calibration
            entity.created_at = _parse_datetime(record.created_at)
            entity.updated_at = _parse_datetime(record.updated_at)
            session.commit()
        return record

    def get_review(self, review_id: str, user_id: str) -> ReviewRecord | None:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entity = (
                session.query(ReviewEntity)
                .filter(
                    ReviewEntity.id == review_id,
                    ReviewEntity.user_id == user_id,
                    ReviewEntity.deleted_at.is_(None),
                )
                .one_or_none()
            )
            return _review_to_domain(entity) if entity else None

    def list_reviews(self, user_id: str) -> list[ReviewRecord]:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entities = (
                session.query(ReviewEntity)
                .filter(ReviewEntity.user_id == user_id, ReviewEntity.deleted_at.is_(None))
                .order_by(ReviewEntity.created_at.desc())
                .all()
            )
            return [_review_to_domain(entity) for entity in entities]

    def save_method(self, card: MethodCard, user_id: str) -> MethodCard:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entity = session.get(MethodCardEntity, card.id)
            if entity is None:
                entity = MethodCardEntity(id=card.id, user_id=user_id)
                session.add(entity)
            entity.source_review_id = card.source_review_id
            entity.title = card.title
            entity.scenes_json = card.scenes
            entity.trigger = card.trigger
            entity.steps_json = card.steps
            entity.reminder = card.reminder
            entity.created_at = _parse_datetime(card.created_at)
            entity.updated_at = _parse_datetime(card.updated_at)
            session.commit()
        return card

    def list_methods(self, user_id: str) -> list[MethodCard]:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entities = (
                session.query(MethodCardEntity)
                .filter(MethodCardEntity.user_id == user_id)
                .order_by(MethodCardEntity.created_at.desc())
                .all()
            )
            return [_method_to_domain(entity) for entity in entities]

    def save_calibration(self, card: CalibrationCard, user_id: str) -> CalibrationCard:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entity = session.get(CalibrationCardEntity, card.id)
            if entity is None:
                entity = CalibrationCardEntity(id=card.id, user_id=user_id)
                session.add(entity)
            entity.source_review_id = card.source_review_id
            entity.worry = card.worry
            entity.scene = card.scene
            entity.estimated_probability = card.estimated_probability
            entity.verification_date = _parse_date(card.verification_date)
            entity.status = card.status
            entity.final_result = card.final_result
            entity.actual_impact = card.actual_impact
            entity.calibration_conclusion = card.calibration_conclusion
            session.commit()
        return card

    def list_calibrations(self, user_id: str) -> list[CalibrationCard]:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entities = (
                session.query(CalibrationCardEntity)
                .filter(CalibrationCardEntity.user_id == user_id)
                .order_by(CalibrationCardEntity.verification_date.desc())
                .all()
            )
            return [_calibration_to_domain(entity) for entity in entities]

    def update_note(self, review_id: str, note: str, user_id: str) -> None:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entity = (
                session.query(ReviewEntity)
                .filter(
                    ReviewEntity.id == review_id,
                    ReviewEntity.user_id == user_id,
                    ReviewEntity.deleted_at.is_(None),
                )
                .one_or_none()
            )
            if entity is not None:
                entity.note = note
                entity.updated_at = datetime.utcnow()
                session.commit()

    def delete_review(self, review_id: str, user_id: str) -> bool:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            entity = (
                session.query(ReviewEntity)
                .filter(
                    ReviewEntity.id == review_id,
                    ReviewEntity.user_id == user_id,
                    ReviewEntity.deleted_at.is_(None),
                )
                .one_or_none()
            )
            if entity is None:
                return False
            entity.deleted_at = datetime.utcnow()
            entity.updated_at = datetime.utcnow()
            (
                session.query(MethodCardEntity)
                .filter(MethodCardEntity.user_id == user_id, MethodCardEntity.source_review_id == review_id)
                .delete(synchronize_session=False)
            )
            (
                session.query(CalibrationCardEntity)
                .filter(CalibrationCardEntity.user_id == user_id, CalibrationCardEntity.source_review_id == review_id)
                .delete(synchronize_session=False)
            )
            session.commit()
            return True

    def delete_method(self, method_id: str, user_id: str) -> bool:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            deleted = (
                session.query(MethodCardEntity)
                .filter(MethodCardEntity.id == method_id, MethodCardEntity.user_id == user_id)
                .delete(synchronize_session=False)
            )
            session.commit()
            return deleted > 0

    def delete_calibration(self, calibration_id: str, user_id: str) -> bool:
        with self.session_factory() as session:
            self._ensure_seeded(session, user_id)
            deleted = (
                session.query(CalibrationCardEntity)
                .filter(CalibrationCardEntity.id == calibration_id, CalibrationCardEntity.user_id == user_id)
                .delete(synchronize_session=False)
            )
            session.commit()
            return deleted > 0

    @staticmethod
    def _ensure_user(session: Any, user_id: str) -> None:
        if session.get(UserEntity, user_id) is None:
            session.add(UserEntity(id=user_id, nickname="me"))
            session.flush()

    def _ensure_seeded(self, session: Any, user_id: str) -> None:
        self._ensure_user(session, user_id)
        session.commit()


def _parse_datetime(value: str | datetime | None) -> datetime:
    if isinstance(value, datetime):
        return value
    if not value:
        return datetime.utcnow()
    try:
        parsed_date = date.fromisoformat(value)
        return datetime.combine(parsed_date, time.min)
    except ValueError:
        return datetime.fromisoformat(value)


def _parse_date(value: str | date | None) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    return date.fromisoformat(value)


def _format_datetime(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.replace(microsecond=0).isoformat()


def _format_date(value: date | None) -> str:
    return value.isoformat() if value else ""


def _review_to_domain(entity: ReviewEntity) -> ReviewRecord:
    return ReviewRecord(
        id=entity.id,
        type=entity.type,
        scene=entity.scene,
        title=entity.title,
        raw_input=entity.raw_input,
        summary=entity.summary_json or {},
        result_card=entity.result_card_json or {},
        note=entity.note or "",
        created_at=_format_datetime(entity.created_at),
        updated_at=_format_datetime(entity.updated_at),
        saved_to_method_library=entity.saved_to_method_library,
        saved_to_calibration=entity.saved_to_calibration,
    )


def _method_to_domain(entity: MethodCardEntity) -> MethodCard:
    return MethodCard(
        id=entity.id,
        source_review_id=entity.source_review_id,
        title=entity.title,
        scenes=entity.scenes_json or [],
        trigger=entity.trigger,
        steps=entity.steps_json or [],
        reminder=entity.reminder,
        created_at=_format_datetime(entity.created_at),
        updated_at=_format_datetime(entity.updated_at),
    )


def _calibration_to_domain(entity: CalibrationCardEntity) -> CalibrationCard:
    return CalibrationCard(
        id=entity.id,
        source_review_id=entity.source_review_id,
        worry=entity.worry,
        scene=entity.scene,
        estimated_probability=entity.estimated_probability,
        verification_date=_format_date(entity.verification_date),
        status=entity.status,
        final_result=entity.final_result,
        actual_impact=entity.actual_impact,
        calibration_conclusion=entity.calibration_conclusion,
    )
