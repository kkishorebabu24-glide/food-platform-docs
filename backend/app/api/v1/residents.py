"""
Resident routes — resident profile management and order history.

All endpoints require authentication.

  GET  /api/v1/residents/me              → get own profile
  PUT  /api/v1/residents/me              → update name, phone, flat_number
  GET  /api/v1/residents/me/orders       → get order history
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.db.models import User
from app.schemas.resident import ResidentProfileResponse, ResidentProfileUpdate
from app.services import order_service

router = APIRouter(prefix="/api/v1/residents", tags=["residents"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)

@router.get("/me", response_model=ResidentProfileResponse)
async def get_my_profile(
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated resident's own profile."""
    return current_user


@router.put("/me")
async def update_my_profile(
    request: ResidentProfileUpdate,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Update the authenticated resident's name, phone, or flat number."""
    if request.name is not None:
        current_user.name = request.name
    if request.phone is not None:
        current_user.phone = request.phone
    if request.flat_number is not None:
        current_user.flat_number = request.flat_number

    current_user.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(current_user)

    return {"message": "Profile updated successfully."}


@router.get("/me/orders")
async def get_my_orders(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated resident's order history, newest first."""
    return order_service.get_resident_orders(
        db, resident_id=current_user.id, skip=skip, limit=limit
    )
