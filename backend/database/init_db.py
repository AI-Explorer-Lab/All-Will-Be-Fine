from __future__ import annotations

from backend.database.models import Base
from backend.database.session import get_engine


def init_database() -> None:
    Base.metadata.create_all(bind=get_engine())
