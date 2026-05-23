from __future__ import annotations

import os
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from backend.config.config import load_config


def get_db_type() -> str:
    return os.getenv("DB_TYPE") or load_config().get("db", {}).get("type", "memory")


def get_database_url() -> str | None:
    return os.getenv("DATABASE_URL") or load_config().get("db", {}).get("url")


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = get_database_url()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required when DB_TYPE is postgres")
    return create_engine(database_url, pool_pre_ping=True, future=True)


def create_session_factory() -> sessionmaker:
    return sessionmaker(autocommit=False, autoflush=False, bind=get_engine(), future=True)
