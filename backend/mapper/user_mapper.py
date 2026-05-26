from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import sessionmaker

from backend.database.init_db import init_database
from backend.database.models import UserEntity
from backend.database.session import create_session_factory, get_db_type


class UserMapper:
    def __init__(self):
        if get_db_type() == "postgres":
            self._impl = PostgresUserMapper()
        else:
            self._impl = MemoryUserMapper()

    def create_user(self, username: str, password_hash: str) -> UserEntity:
        return self._impl.create_user(username, password_hash)

    def get_by_username(self, username: str) -> UserEntity | None:
        return self._impl.get_by_username(username)

    def get_by_id(self, user_id: str) -> UserEntity | None:
        return self._impl.get_by_id(user_id)


class MemoryUserMapper:
    _users_by_id: dict[str, UserEntity] = {}
    _ids_by_username: dict[str, str] = {}

    def create_user(self, username: str, password_hash: str) -> UserEntity:
        if username in self._ids_by_username:
            raise ValueError("username already exists")
        now = datetime.utcnow().replace(microsecond=0)
        user = UserEntity(
            id=f"user-{uuid4().hex}",
            username=username,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
        )
        self._users_by_id[user.id] = user
        self._ids_by_username[username] = user.id
        return user

    def get_by_username(self, username: str) -> UserEntity | None:
        user_id = self._ids_by_username.get(username)
        return self._users_by_id.get(user_id or "")

    def get_by_id(self, user_id: str) -> UserEntity | None:
        return self._users_by_id.get(user_id)


class PostgresUserMapper:
    def __init__(self, session_factory: sessionmaker | None = None):
        init_database()
        self.session_factory = session_factory or create_session_factory()

    def create_user(self, username: str, password_hash: str) -> UserEntity:
        with self.session_factory() as session:
            if self._get_by_username(session, username) is not None:
                raise ValueError("username already exists")
            user = UserEntity(
                id=f"user-{uuid4().hex}",
                username=username,
                password_hash=password_hash,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return _detached_user(user)

    def get_by_username(self, username: str) -> UserEntity | None:
        with self.session_factory() as session:
            user = self._get_by_username(session, username)
            return _detached_user(user) if user else None

    def get_by_id(self, user_id: str) -> UserEntity | None:
        with self.session_factory() as session:
            user = session.get(UserEntity, user_id)
            return _detached_user(user) if user else None

    @staticmethod
    def _get_by_username(session, username: str) -> UserEntity | None:
        return session.query(UserEntity).filter(UserEntity.username == username).one_or_none()


def _detached_user(user: UserEntity) -> UserEntity:
    return UserEntity(
        id=user.id,
        username=user.username,
        password_hash=user.password_hash,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
