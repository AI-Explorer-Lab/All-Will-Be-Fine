from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.domain.req import CreateReviewRequest, UpdateNoteRequest
from backend.domain.res import success
from backend.middlewares.auth_dependency import get_current_user
from backend.service.review_service import ReviewService


router = APIRouter(tags=["review"])
service = ReviewService()


@router.post("/reviews/analyze")
def analyze_review(payload: dict, user=Depends(get_current_user)):
    request = CreateReviewRequest.from_dict(payload)
    return success(service.analyze(request, user))


@router.get("/reviews")
def list_reviews(user=Depends(get_current_user)):
    return success(service.list_records(user))


@router.get("/reviews/{review_id}")
def get_review(review_id: str, user=Depends(get_current_user)):
    return success(service.get_record(review_id, user))


@router.get("/methods")
def list_methods(user=Depends(get_current_user)):
    return success(service.list_methods(user))


@router.get("/calibrations")
def list_calibrations(user=Depends(get_current_user)):
    return success(service.list_calibrations(user))


@router.post("/reviews/{review_id}/note")
def update_note(review_id: str, payload: dict, user=Depends(get_current_user)):
    request = UpdateNoteRequest.from_dict(payload)
    return success(service.update_note(review_id, request, user))
