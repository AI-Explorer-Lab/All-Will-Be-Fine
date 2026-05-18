from __future__ import annotations

from backend.domain.models import UserContext


def get_current_user() -> UserContext:
    return UserContext(user_id="local-user", nickname="me")
