from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base


Base = declarative_base()


def utc_now() -> datetime:
    return datetime.utcnow().replace(microsecond=0)


class UserEntity(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    username = Column(String(128), nullable=True, unique=True, index=True)
    password_hash = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)


class ReviewEntity(Base):
    __tablename__ = "reviews"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(32), nullable=False, index=True)
    scene = Column(String(128), nullable=False, default="")
    title = Column(String(256), nullable=False, default="")
    raw_input = Column(Text, nullable=False, default="")
    tags_json = Column(JSONB, nullable=False, default=list)
    summary_json = Column(JSONB, nullable=False, default=dict)
    deep_review_json = Column(JSONB, nullable=False, default=dict)
    result_card_json = Column(JSONB, nullable=False, default=dict)
    note = Column(Text, nullable=False, default="")
    saved_to_method_library = Column(Boolean, nullable=False, default=False)
    saved_to_calibration = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)
    deleted_at = Column(DateTime, nullable=True)


class MethodCardEntity(Base):
    __tablename__ = "method_cards"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    source_review_id = Column(String(64), ForeignKey("reviews.id"), nullable=False, index=True)
    title = Column(String(256), nullable=False, default="")
    scenes_json = Column(JSONB, nullable=False, default=list)
    trigger = Column(Text, nullable=False, default="")
    steps_json = Column(JSONB, nullable=False, default=list)
    reminder = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)


class CalibrationCardEntity(Base):
    __tablename__ = "calibration_cards"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    source_review_id = Column(String(64), ForeignKey("reviews.id"), nullable=False, index=True)
    worry = Column(Text, nullable=False, default="")
    scene = Column(String(128), nullable=False, default="")
    estimated_probability = Column(String(64), nullable=False, default="")
    verification_date = Column(Date, nullable=True)
    status = Column(String(32), nullable=False, default="pending")
    final_result = Column(Text, nullable=False, default="")
    actual_impact = Column(String(128), nullable=False, default="")
    calibration_conclusion = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)


class MonitorRequestMetricEntity(Base):
    __tablename__ = "monitor_request_metrics"

    id = Column(String(64), primary_key=True)
    method = Column(String(16), nullable=False, index=True)
    path = Column(String(512), nullable=False, index=True)
    status_code = Column(Integer, nullable=False, index=True)
    duration_ms = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)
