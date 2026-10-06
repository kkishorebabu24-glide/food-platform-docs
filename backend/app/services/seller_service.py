"""
Seller service — profile creation, lookup, update, and admin approval.
"""

import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, status
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.models import SellerProfile, User
from app.db.models.enums import ApprovalStatus, UserRole
from app.schemas.seller import SellerRegisterRequest, SellerUpdateRequest

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE_MB = 5
UPLOAD_DIR_SELLERS = Path("uploads/sellers")


def list_approved_sellers(db: Session, skip: int = 0, limit: int = 20) -> dict:
    """Return paginated list of approved, active sellers."""
    query = (
        db.query(SellerProfile, User)
        .join(User, User.id == SellerProfile.id)
        .filter(
            SellerProfile.approval_status == ApprovalStatus.approved,
            User.is_active == True,
        )
        .offset(skip)
        .limit(limit)
    )
    results = query.all()

    total = (
        db.query(SellerProfile)
        .filter(SellerProfile.approval_status == ApprovalStatus.approved)
        .count()
    )

    sellers = [
        {
            "id": seller.id,
            "name": user.name,
            "bio": seller.bio,
            "photo_url": seller.photo_url,
            "banner_url": getattr(seller, "banner_url", None),
            "photos": getattr(seller, "photos", []) or [],
            "rating": seller.rating,
            "review_count": seller.review_count,
            "on_time_delivery_rate": getattr(seller, "on_time_delivery_rate", 100.0),
            "punctuality_rating": getattr(seller, "punctuality_rating", 5.0),
            "avg_delivery_minutes": getattr(seller, "avg_delivery_minutes", 25),
            "flat_number": user.flat_number,
            "is_open": getattr(seller, "is_open", True),
        }
        for seller, user in results
    ]
    return {"sellers": sellers, "total": total, "skip": skip, "limit": limit}


def get_seller_by_id(db: Session, seller_id: int) -> tuple[SellerProfile, User]:
    """Return (SellerProfile, User) for a given seller_id, or raise 404."""
    result = (
        db.query(SellerProfile, User)
        .join(User, User.id == SellerProfile.id)
        .filter(SellerProfile.id == seller_id)
        .first()
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller {seller_id} not found.",
        )
    return result


def register_seller_profile(
    db: Session,
    user: User,
    request: SellerRegisterRequest,
) -> SellerProfile:
    """
    Create a SellerProfile for an existing user (pending admin approval).
    Raises 409 if the user already has a seller profile.
    """
    existing = db.query(SellerProfile).filter(SellerProfile.id == user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seller profile already exists for this user.",
        )

    profile = SellerProfile(
        id=user.id,
        bio=request.bio,
        approval_status=ApprovalStatus.pending,
    )
    # Update user role to seller
    user.role = UserRole.seller
    user.updated_at = datetime.now(UTC)

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_seller_profile(
    db: Session,
    seller_id: int,
    request: SellerUpdateRequest,
) -> SellerProfile:
    """Update bio, photo_url, or upi_id on a seller's profile."""
    """Update bio, photo_url, banner_url, photos, or upi_id on a seller's profile."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found."
        )

    if request.bio is not None:
        seller.bio = request.bio
    if request.photo_url is not None:
        seller.photo_url = request.photo_url
    if request.banner_url is not None:
        seller.banner_url = request.banner_url
    if request.photos is not None:
        seller.photos = list(request.photos)
    if request.upi_id is not None:
        seller.upi_id = request.upi_id.strip() if request.upi_id else None
        seller.is_upi_verified = bool(seller.upi_id)
    if request.upi_account_name is not None:
        seller.upi_account_name = request.upi_account_name.strip() if request.upi_account_name else None

    seller.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(seller)
    return seller


async def _save_image_file(file: UploadFile, filename_prefix: str) -> tuple[str, bytes]:
    """Validate and return (extension, content) for an uploaded image."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type: {file.content_type}. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image too large ({size_mb:.1f} MB). Maximum allowed: {MAX_IMAGE_SIZE_MB} MB.",
        )
    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    ext = ext_map.get(file.content_type, "jpg")
    return ext, content


async def upload_seller_photo(db: Session, seller_id: int, file: UploadFile) -> str:
    """Upload and set avatar photo for a seller."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found.")

    ext, content = await _save_image_file(file, f"{seller_id}_avatar")
    UPLOAD_DIR_SELLERS.mkdir(parents=True, exist_ok=True)

    filename = f"{seller_id}_avatar.{ext}"
    file_path = UPLOAD_DIR_SELLERS / filename
    file_path.write_bytes(content)

    seller.photo_url = f"/uploads/sellers/{filename}"
    seller.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(seller)
    return seller.photo_url


async def upload_seller_banner(
    db: Session, seller_id: int, file: UploadFile | None = None, preset_url: str | None = None
) -> str:
    """Upload and set kitchen banner for a seller (via uploaded image file or curated preset URL)."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found.")

    if preset_url:
        seller.banner_url = preset_url
        seller.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(seller)
        return seller.banner_url

    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a banner image file or a preset_url must be provided.",
        )

    ext, content = await _save_image_file(file, f"{seller_id}_banner")
    UPLOAD_DIR_SELLERS.mkdir(parents=True, exist_ok=True)

    filename = f"{seller_id}_banner.{ext}"
    file_path = UPLOAD_DIR_SELLERS / filename
    file_path.write_bytes(content)

    seller.banner_url = f"/uploads/sellers/{filename}"
    seller.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(seller)
    return seller.banner_url


async def upload_seller_photos(db: Session, seller_id: int, files: list[UploadFile]) -> list[str]:
    """Upload one or multiple photos to a seller's kitchen gallery."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found.")

    UPLOAD_DIR_SELLERS.mkdir(parents=True, exist_ok=True)
    current_photos = list(getattr(seller, "photos", []) or [])

    for file in files:
        ext, content = await _save_image_file(file, f"{seller_id}_gallery")
        uid = uuid.uuid4().hex[:8]
        filename = f"{seller_id}_gallery_{uid}.{ext}"
        file_path = UPLOAD_DIR_SELLERS / filename
        file_path.write_bytes(content)
        current_photos.append(f"/uploads/sellers/{filename}")

    seller.photos = current_photos
    seller.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(seller)
    return seller.photos


def delete_seller_photo(db: Session, seller_id: int, photo_url: str) -> list[str]:
    """Delete a photo from a seller's kitchen gallery."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found.")

    current_photos = list(getattr(seller, "photos", []) or [])
    if photo_url in current_photos:
        current_photos.remove(photo_url)
        # Attempt to unlink file if in uploads
        if photo_url.startswith("/uploads/"):
            try:
                local_path = Path(photo_url.lstrip("/"))
                if local_path.exists():
                    local_path.unlink()
            except Exception as e:
                logger.warning("Failed to delete local photo file %s: %s", photo_url, e)

    seller.photos = current_photos
    seller.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(seller)
    return seller.photos


def get_pending_sellers(db: Session, skip: int = 0, limit: int = 20) -> dict:
    """Return sellers awaiting admin approval."""
    query = (
        db.query(SellerProfile, User)
        .join(User, User.id == SellerProfile.id)
        .filter(
            SellerProfile.approval_status == ApprovalStatus.pending,
            User.is_active == True,
        )
        .offset(skip)
        .limit(limit)
    )
    results = query.all()
    total = (
        db.query(SellerProfile)
        .filter(SellerProfile.approval_status == ApprovalStatus.pending)
        .count()
    )

    sellers = [
        {
            "id": seller.id,
            "name": user.name,
            "email": user.email,
            "flat_number": user.flat_number,
        }
        for seller, user in results
    ]
    return {"sellers": sellers, "total": total}


def approve_seller(db: Session, seller_id: int) -> SellerProfile:
    """Approve a pending seller (admin action)."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found."
        )
    seller.approval_status = ApprovalStatus.approved
    seller.updated_at = datetime.now(UTC)
    db.commit()
    return seller


def reject_seller(db: Session, seller_id: int) -> User:
    """Reject a pending seller — deactivates the user (admin action)."""
    user = db.query(User).filter(User.id == seller_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found."
        )

    # Also update seller profile approval_status
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if seller:
        seller.approval_status = ApprovalStatus.rejected
        seller.updated_at = datetime.now(UTC)

    user.is_active = False
    user.updated_at = datetime.now(UTC)
    db.commit()
    return user
