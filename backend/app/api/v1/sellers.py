"""
Seller legacy routes — backward-compatibility alias for partner routes.

All operations delegate to partner_service and order_service, allowing
existing clients using /api/v1/sellers to continue functioning without changes.
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, require_role
from app.core.config import settings
from app.db.models import User
from app.schemas.partner import PartnerRegisterRequest, PartnerUpdateRequest
from app.services import order_service, partner_service

router = APIRouter(prefix="/api/v1/sellers", tags=["sellers (legacy alias)"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)
SELLER_OR_ADMIN_DEPENDENCY = Depends(require_role("partner", "seller", "admin"))


@router.get("/")
async def list_sellers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = DB_DEPENDENCY,
):
    """List all approved sellers/partners (public — no auth required)."""
    return partner_service.list_approved_partners(db, skip=skip, limit=limit)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_seller(
    request: PartnerRegisterRequest,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Register the authenticated user as a seller/partner."""
    profile = partner_service.register_partner_profile(db, current_user, request)
    return {
        "message": "Seller registration submitted. Awaiting admin approval.",
        "seller_id": profile.id,
        "partner_id": profile.id,
    }


@router.get("/me")
async def get_my_seller_profile(
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated seller/partner's own profile."""
    partner, user = partner_service.get_partner_by_id(db, current_user.id)
    return {
        "id": partner.id,
        "seller_id": partner.id,
        "name": user.name,
        "email": user.email,
        "bio": partner.bio,
        "photo_url": partner.photo_url,
        "banner_url": getattr(partner, "banner_url", None),
        "photos": getattr(partner, "photos", []) or [],
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
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Update the authenticated seller/partner's own profile."""
    partner_service.update_partner_profile(db, current_user.id, request)
    return {"message": "Profile updated successfully."}


@router.post("/me/photo")
async def upload_my_photo(
    file: UploadFile = File(..., description="Avatar/logo image (JPEG, PNG, WebP — max 5 MB)"),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Upload seller avatar photo."""
    photo_url = await partner_service.upload_partner_photo(db, current_user.id, file)
    return {"photo_url": photo_url, "message": "Avatar photo updated successfully."}


@router.post("/me/banner")
async def upload_my_banner(
    file: UploadFile
    | None = File(default=None, description="Kitchen banner image (JPEG, PNG, WebP — max 5 MB)"),
    preset_url: str | None = Query(default=None, description="Curated banner preset URL"),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Upload seller kitchen banner or select a curated preset banner URL."""
    banner_url = await partner_service.upload_partner_banner(
        db, current_user.id, file=file, preset_url=preset_url
    )
    return {"banner_url": banner_url, "message": "Kitchen banner updated successfully."}


@router.post("/me/photos")
async def upload_my_photos(
    files: list[UploadFile] = File(
        ..., description="Gallery photos (JPEG, PNG, WebP — max 5 MB each)"
    ),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Upload one or more photos to seller kitchen gallery."""
    photos = await partner_service.upload_partner_photos(db, current_user.id, files)
    return {"photos": photos, "message": f"{len(files)} photo(s) added to gallery."}


@router.delete("/me/photos")
async def delete_my_photo(
    photo_url: str = Query(..., description="Photo URL to delete"),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Delete a photo from seller kitchen gallery."""
    photos = partner_service.delete_partner_photo(db, current_user.id, photo_url)
    return {"photos": photos, "message": "Photo deleted successfully."}


@router.get("/me/orders")
async def get_my_orders(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: str
    | None = Query(
        default=None,
        alias="status",
        description="Filter by order status: placed, accepted, preparing, ready, delivered, cancelled",
    ),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated seller/partner's orders."""
    return order_service.get_partner_orders(
        db,
        partner_id=current_user.id,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
    )


@router.patch("/me/open")
async def toggle_open_status(
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Toggle the seller's open/closed status."""
    partner, user = partner_service.get_partner_by_id(db, current_user.id)

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


@router.get("/{seller_id}")
async def get_seller(seller_id: int, db: Session = DB_DEPENDENCY):
    """Get a seller/partner's public profile by id."""
    partner, user = partner_service.get_partner_by_id(db, seller_id)
    return {
        "id": partner.id,
        "seller_id": partner.id,
        "name": user.name,
        "bio": partner.bio,
        "photo_url": partner.photo_url,
        "banner_url": getattr(partner, "banner_url", None),
        "photos": getattr(partner, "photos", []) or [],
        "rating": partner.rating,
        "review_count": partner.review_count,
        "flat_number": user.flat_number,
        "is_approved": partner.is_approved,
        "is_open": partner.is_open,
    }
