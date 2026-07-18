from __future__ import annotations

from sqlalchemy import inspect, text

from backend.database.models import Base
from backend.database.session import get_engine


def init_database() -> None:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    _ensure_user_auth_columns(engine)
    _ensure_review_tags_column(engine)


def _ensure_user_auth_columns(engine) -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    statements = []
    if "username" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN username VARCHAR(128)")
    if "password_hash" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "nickname" in columns:
        statements.append("ALTER TABLE users DROP COLUMN nickname")

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        if engine.dialect.name == "postgresql":
            connection.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username_unique ON users (username) WHERE username IS NOT NULL")
            )


def _ensure_review_tags_column(engine) -> None:
    inspector = inspect(engine)
    if "reviews" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("reviews")}
    if "tags_json" in columns:
        return
    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            connection.execute(text("ALTER TABLE reviews ADD COLUMN tags_json JSONB NOT NULL DEFAULT '[]'::jsonb"))
