from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from backend.domain.req import CreateReviewRequest, FollowUpRequest, UpdateNoteRequest
from backend.domain.res import success
from backend.middlewares.auth_dependency import get_current_user
from backend.service.review_service import ReviewService


router = APIRouter(tags=["review"])
service = ReviewService()


@router.post("/reviews/analyze")
def analyze_review(payload: dict, user=Depends(get_current_user)):
    request = CreateReviewRequest.from_dict(payload)
    return success(service.analyze(request, user))


@router.post("/reviews/save")
def save_review_bundle(payload: dict, user=Depends(get_current_user)):
    return success(service.save_bundle_payload(payload, user))


@router.get("/reviews")
def list_reviews(user=Depends(get_current_user)):
    return success(service.list_records(user))


@router.head("/reviews")
def head_reviews():
    return Response(status_code=200)


@router.get("/reviews/{review_id}")
def get_review(review_id: str, user=Depends(get_current_user)):
    return success(service.get_record(review_id, user))


@router.delete("/reviews/{review_id}")
def delete_review(review_id: str, user=Depends(get_current_user)):
    return success(service.delete_record(review_id, user))


@router.put("/reviews/{review_id}")
def update_review(review_id: str, payload: dict, user=Depends(get_current_user)):
    return success(service.update_record_payload(review_id, payload, user))


@router.get("/methods")
def list_methods(user=Depends(get_current_user)):
    return success(service.list_methods(user))


@router.head("/methods")
def head_methods():
    return Response(status_code=200)


@router.delete("/methods/{method_id}")
def delete_method(method_id: str, user=Depends(get_current_user)):
    return success(service.delete_method(method_id, user))


@router.put("/methods/{method_id}")
def update_method(method_id: str, payload: dict, user=Depends(get_current_user)):
    return success(service.update_method_payload(method_id, payload, user))


@router.get("/calibrations")
def list_calibrations(user=Depends(get_current_user)):
    return success(service.list_calibrations(user))


@router.head("/calibrations")
def head_calibrations():
    return Response(status_code=200)


@router.delete("/calibrations/{calibration_id}")
def delete_calibration(calibration_id: str, user=Depends(get_current_user)):
    return success(service.delete_calibration(calibration_id, user))


@router.put("/calibrations/{calibration_id}")
def update_calibration(calibration_id: str, payload: dict, user=Depends(get_current_user)):
    return success(service.update_calibration_payload(calibration_id, payload, user))


@router.post("/reviews/{review_id}/note")
def update_note(review_id: str, payload: dict, user=Depends(get_current_user)):
    request = UpdateNoteRequest.from_dict(payload)
    return success(service.update_note(review_id, request, user))


@router.post("/reviews/{review_id}/follow-up")
def follow_up_review(review_id: str, payload: dict, user=Depends(get_current_user)):
    request = FollowUpRequest.from_dict(payload)
    return success(service.follow_up(review_id, request, user))
