from __future__ import annotations

from fastapi import APIRouter

from backend.domain.res import success
from backend.service.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])
service = AuthService()


@router.post("/register")
def register(payload: dict):
    return success(service.register(payload))


@router.post("/login")
def login(payload: dict):
    return success(service.login(payload))
