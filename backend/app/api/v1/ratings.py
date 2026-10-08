"""
Rating routes — submit and view partner ratings.

Authenticated (resident):
  POST /api/v1/ratings/orders/{order_id}    → submit a rating for a completed order

Public:
  GET  /api/v1/ratings/partners/{partner_id}  → get all ratings for a partner
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_role
from app.db.models import User
from app.schemas.rating import RatingCreateRequest
from app.services import rating_service

router = APIRouter(prefix="/api/v1/ratings", tags=["ratings"])

DB_DEPENDENCY = Depends(get_db)
RESIDENT_OR_ADMIN_DEPENDENCY = Depends(require_role("resident", "admin"))


@router.post("/orders/{order_id}", status_code=201)
async def rate_order(
    order_id: int,
    request: RatingCreateRequest,
    current_user: User = RESIDENT_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Submit a rating for a completed order (resident only)."""
    rating = rating_service.create_rating(
        db, order_id=order_id, rater_id=current_user.id, request=request
    )
    return {
        "id": rating.id,
        "order_id": rating.order_id,
        "partner_id": rating.partner_id,
        "score": rating.score,
        "review_text": rating.review_text,
    }


@router.get("/partners/{partner_id}")
async def get_partner_ratings(
    partner_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = DB_DEPENDENCY,
):
    """Get paginated ratings and aggregate summary for a partner (public)."""
    return rating_service.get_partner_ratings(db, partner_id=partner_id, skip=skip, limit=limit)
