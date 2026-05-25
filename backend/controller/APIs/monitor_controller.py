from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header

from backend.domain.res import success
from backend.service.monitor_service import MonitorAuthService, MonitorService


router = APIRouter(prefix="/monitor", tags=["monitor"])
auth_service = MonitorAuthService()
monitor_service = MonitorService()


@router.post("/login")
def login(payload: dict):
    return success(auth_service.login(payload))


@router.get("/summary")
def summary(authorization: Optional[str] = Header(default=None)):
    auth_service.require_admin(authorization)
    return success(monitor_service.summary())
