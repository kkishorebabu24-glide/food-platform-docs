import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.models import PartnerProfile, User
from app.db.models.enums import PartnerApplicationStatus, PartnerStatus, UserRole
from app.schemas.partner import PartnerRegisterRequest, PartnerUpdateRequest

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE_MB = 5
UPLOAD_DIR_PARTNERS = Path("uploads/sellers")


def list_approved_partners(db: Session, skip: int = 0, limit: int = 20) -> dict:
    """Return paginated list of approved, active partners."""
    query = (
        db.query(PartnerProfile, User)
        .join(User, User.id == PartnerProfile.id)
        .filter(
            PartnerProfile.application_status == PartnerApplicationStatus.approved,
            PartnerProfile.partner_status == PartnerStatus.active,
            User.is_active.is_(True),
        )
    )
    total = query.count()
    results = query.offset(skip).limit(limit).all()

    partners = [
        {
            "id": partner.id,
            "name": user.name,
            "bio": partner.bio,
            "photo_url": partner.photo_url,
            "banner_url": getattr(partner, "banner_url", None),
            "photos": getattr(partner, "photos", []) or [],
            "rating": partner.rating,
            "review_count": partner.review_count,
            "on_time_delivery_rate": getattr(partner, "on_time_delivery_rate", 100.0),
            "punctuality_rating": getattr(partner, "punctuality_rating", 5.0),
            "avg_delivery_minutes": getattr(partner, "avg_delivery_minutes", 25),
            "flat_number": user.flat_number,
            "is_open": getattr(partner, "is_open", True),
        }
        for partner, user in results
    ]
    return {
        "partners": partners,
        "sellers": partners,  # backward compatibility
        "total": total,
        "skip": skip,
        "limit": limit,
    }


def get_partner_by_id(db: Session, partner_id: int) -> tuple[PartnerProfile, User]:
    """Return (PartnerProfile, User) for a given partner_id, or raise 404."""
    result = (
        db.query(PartnerProfile, User)
        .join(User, User.id == PartnerProfile.id)
        .filter(PartnerProfile.id == partner_id)
        .first()
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner {partner_id} not found.",
        )
    return result


def register_partner_profile(
    db: Session,
    user: User,
    request: PartnerRegisterRequest,
) -> PartnerProfile:
    """
    Submit a partner application for an existing user (pending admin approval).

    The user keeps their current role until an admin approves the application;
    only then can they switch into the partner workspace. Rejected or withdrawn
    applicants may re-apply. Raises 409 for an open or approved application and
    403 for privileged accounts.
    """
    if user.role in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot apply as partners.",
        )
    existing = db.query(PartnerProfile).filter(PartnerProfile.id == user.id).first()
    reapplicable = {
        PartnerApplicationStatus.rejected,
        PartnerApplicationStatus.withdrawn,
    }
    if existing and existing.application_status not in reapplicable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Partner profile already exists for this user.",
        )

    if existing:
        profile = existing
        profile.bio = request.bio
        profile.application_status = PartnerApplicationStatus.pending
        profile.partner_status = PartnerStatus.pending
        profile.updated_at = datetime.now(UTC)
    else:
        profile = PartnerProfile(
            id=user.id,
            bio=request.bio,
            application_status=PartnerApplicationStatus.pending,
            partner_status=PartnerStatus.pending,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)
    return profile


def update_partner_profile(
    db: Session,
    partner_id: int,
    request: PartnerUpdateRequest,
) -> PartnerProfile:
    """Update bio, photo_url, or upi_id on a partner's profile."""
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

    if request.bio is not None:
        partner.bio = request.bio
    if request.photo_url is not None:
        partner.photo_url = request.photo_url
    if request.upi_id is not None:
        partner.upi_id = request.upi_id.strip() if request.upi_id else None
        partner.is_upi_verified = bool(partner.upi_id)
    if request.upi_account_name is not None:
        partner.upi_account_name = (
            request.upi_account_name.strip() if request.upi_account_name else None
        )

    partner.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(partner)
    return partner


def get_pending_partners(db: Session, skip: int = 0, limit: int = 20) -> dict:
    """Return partners awaiting admin approval."""
    query = (
        db.query(PartnerProfile, User)
        .join(User, User.id == PartnerProfile.id)
        .filter(
            PartnerProfile.application_status.in_(
                [
                    PartnerApplicationStatus.pending,
                    PartnerApplicationStatus.under_review,
                ]
            ),
            User.is_active.is_(True),
        )
    )
    total = query.count()
    results = query.offset(skip).limit(limit).all()

    partners = [
        {
            "id": partner.id,
            "name": user.name,
            "email": user.email,
            "flat_number": user.flat_number,
            "application_status": partner.application_status.value,
        }
        for partner, user in results
    ]
    return {"partners": partners, "total": total}


def approve_partner(db: Session, partner_id: int) -> PartnerProfile:
    """Approve a partner application and activate the partner account (admin action)."""
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")
    if partner.application_status == PartnerApplicationStatus.withdrawn:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot approve a withdrawn application.",
        )
    partner.application_status = PartnerApplicationStatus.approved
    partner.partner_status = PartnerStatus.active
    partner.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(partner)
    return partner


def reject_partner(db: Session, partner_id: int) -> PartnerProfile:
    """
    Reject a partner application (admin action).

    Only the partner capability is revoked: the user's account stays active and
    is returned to the resident workspace, so they can keep ordering and re-apply.
    """
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

    now = datetime.now(UTC)
    partner.application_status = PartnerApplicationStatus.rejected
    partner.partner_status = PartnerStatus.inactive
    partner.is_open = False
    partner.updated_at = now

    user = db.query(User).filter(User.id == partner_id).first()
    if user and user.role == UserRole.partner:
        user.role = UserRole.resident
        user.updated_at = now
    db.commit()
    db.refresh(partner)
    return partner


async def _save_image_file(file: UploadFile, prefix: str) -> tuple[str, bytes]:
    """Helper to validate and extract extension and content of uploaded image."""
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


async def upload_partner_photo(db: Session, partner_id: int, file: UploadFile) -> str:
    """Upload and set avatar photo for a partner."""
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

    ext, content = await _save_image_file(file, f"{partner_id}_avatar")
    UPLOAD_DIR_PARTNERS.mkdir(parents=True, exist_ok=True)

    filename = f"{partner_id}_avatar.{ext}"
    file_path = UPLOAD_DIR_PARTNERS / filename
    file_path.write_bytes(content)

    partner.photo_url = f"/uploads/sellers/{filename}"
    partner.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(partner)
    return partner.photo_url


async def upload_partner_banner(
    db: Session,
    partner_id: int,
    file: UploadFile | None = None,
    preset_url: str | None = None,
) -> str:
    """Upload and set kitchen banner for a partner (via uploaded image file or curated preset URL)."""
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

    if preset_url:
        partner.banner_url = preset_url
        partner.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(partner)
        return partner.banner_url

    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a banner image file or a preset_url must be provided.",
        )

    ext, content = await _save_image_file(file, f"{partner_id}_banner")
    UPLOAD_DIR_PARTNERS.mkdir(parents=True, exist_ok=True)

    filename = f"{partner_id}_banner.{ext}"
    file_path = UPLOAD_DIR_PARTNERS / filename
    file_path.write_bytes(content)

    partner.banner_url = f"/uploads/sellers/{filename}"
    partner.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(partner)
    return partner.banner_url


async def upload_partner_photos(db: Session, partner_id: int, files: list[UploadFile]) -> list[str]:
    """Upload one or multiple photos to a partner's kitchen gallery."""
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

    UPLOAD_DIR_PARTNERS.mkdir(parents=True, exist_ok=True)
    current_photos = list(getattr(partner, "photos", []) or [])

    for file in files:
        ext, content = await _save_image_file(file, f"{partner_id}_gallery")
        uid = uuid.uuid4().hex[:8]
        filename = f"{partner_id}_gallery_{uid}.{ext}"
        file_path = UPLOAD_DIR_PARTNERS / filename
        file_path.write_bytes(content)
        current_photos.append(f"/uploads/sellers/{filename}")

    partner.photos = current_photos
    partner.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(partner)
    return partner.photos


def delete_partner_photo(db: Session, partner_id: int, photo_url: str) -> list[str]:
    """Delete a photo from a partner's kitchen gallery."""
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")

    current_photos = list(getattr(partner, "photos", []) or [])
    if photo_url in current_photos:
        current_photos.remove(photo_url)
        if photo_url.startswith("/uploads/"):
            try:
                local_path = Path(photo_url.lstrip("/"))
                if local_path.exists():
                    local_path.unlink()
            except Exception as e:
                logger.warning("Failed to delete local photo file %s: %s", photo_url, e)

    partner.photos = current_photos
    partner.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(partner)
    return partner.photos


# ── Backward compatibility aliases ───────────────────────────────────────────
upload_seller_photo = upload_partner_photo
upload_seller_banner = upload_partner_banner
upload_seller_photos = upload_partner_photos
delete_seller_photo = delete_partner_photo
get_seller_by_id = get_partner_by_id
list_approved_sellers = list_approved_partners
