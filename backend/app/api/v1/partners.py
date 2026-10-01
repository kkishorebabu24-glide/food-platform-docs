"""
Partner routes — browse partners, manage profiles, and order management.

Public:
  GET  /api/v1/partners/                   → list approved partners
  GET  /api/v1/partners/{id}               → get partner detail

Authenticated (partner or admin):
  POST /api/v1/partners/register           → register as a partner
  GET  /api/v1/partners/me                 → get own profile
  PUT  /api/v1/partners/me                 → update own profile
  GET  /api/v1/partners/me/orders          → get own orders (with optional status filter)
  PATCH /api/v1/partners/me/open          → toggle open/closed status
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, require_role
from app.core.config import settings
from app.db.models import User
from app.schemas.partner import PartnerRegisterRequest, PartnerUpdateRequest
from app.services import order_service, partner_service

router = APIRouter(prefix="/api/v1/partners", tags=["partners"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)
PARTNER_OR_ADMIN_DEPENDENCY = Depends(require_role("partner", "admin"))


@router.get("/")
async def list_partners(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = DB_DEPENDENCY,
):
    """List all approved partners (public — no auth required)."""
    return partner_service.list_approved_partners(db, skip=skip, limit=limit)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_partner(
    request: PartnerRegisterRequest,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Register the authenticated user as a partner.
    Creates a PartnerProfile pending admin approval.
    """
    profile = partner_service.register_partner_profile(db, current_user, request)
    return {
        "message": "Partner registration submitted. Awaiting admin approval.",
        "partner_id": profile.id,
    }


@router.get("/me")
async def get_my_partner_profile(
    current_user: User = PARTNER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated partner's own profile."""
    partner, user = partner_service.get_partner_by_id(db, current_user.id)
    return {
        "id": partner.id,
        "name": user.name,
        "email": user.email,
        "bio": partner.bio,
        "photo_url": partner.photo_url,
        "upi_id": partner.upi_id,
        "upi_account_name": getattr(partner, "upi_account_name", None),
        "is_upi_verified": getattr(partner, "is_upi_verified", bool(partner.upi_id)),
        "free_orders_remaining": getattr(partner, "free_orders_remaining", 50),
        "maintenance_balance": float(getattr(partner, "maintenance_balance", 0.0)),
        "rating": partner.rating,
        "review_count": partner.review_count,
        "flat_number": user.flat_number,
        "is_approved": partner.is_approved,
        "is_open": partner.is_open,
    }


@router.put("/me")
async def update_my_profile(
    request: PartnerUpdateRequest,
    current_user: User = PARTNER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Update the authenticated partner's own profile."""
    partner_service.update_partner_profile(db, current_user.id, request)
    return {"message": "Profile updated successfully."}


@router.get("/me/orders")
async def get_my_orders(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status",
        description="Filter by order status: placed, accepted, preparing, ready, dispatched, in_transit, delivered, cancelled"),
    current_user: User = PARTNER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated partner's orders, newest first. Optionally filter by status."""
    return order_service.get_partner_orders(
        db,
        partner_id=current_user.id,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
    )


@router.patch("/me/open")
async def toggle_open_status(
    current_user: User = PARTNER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Toggle the partner's open/closed status.

    When closed (is_open=False), residents cannot place new orders.
    Closed status does not affect existing orders or menu visibility.
    """
    partner, user = partner_service.get_partner_by_id(db, current_user.id)

    # When opening the kitchen, ensure UPI is configured and maintenance quota is healthy
    if not partner.is_open:
        if not partner.upi_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please configure your UPI ID in Kitchen Settings / Profile before opening your kitchen for orders.",
            )
        free_left = (
            partner.free_orders_remaining
            if partner.free_orders_remaining is not None
            else settings.FREE_ORDERS_QUOTA
        )
        bal = float(partner.maintenance_balance or 0.0)
        if free_left <= 0 and bal < settings.MAINTENANCE_GRACE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Your free quota has expired and maintenance balance is below the grace limit. Please recharge credits to open your kitchen.",
            )

    partner.is_open = not partner.is_open
    db.commit()
    db.refresh(partner)
    state = "open" if partner.is_open else "closed"
    return {
        "is_open": partner.is_open,
        "message": f"You are now {state} for orders.",
    }


@router.get("/{partner_id}")
async def get_partner(partner_id: int, db: Session = DB_DEPENDENCY):
    """Get a partner's public profile by id."""
    partner, user = partner_service.get_partner_by_id(db, partner_id)
    return {
        "id": partner.id,
        "name": user.name,
        "bio": partner.bio,
        "photo_url": partner.photo_url,
        "rating": partner.rating,
        "review_count": partner.review_count,
        "flat_number": user.flat_number,
        "is_approved": partner.is_approved,
        "is_open": partner.is_open,
    }
