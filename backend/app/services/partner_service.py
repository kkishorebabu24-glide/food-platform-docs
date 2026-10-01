"""
Partner service — profile creation, lookup, update, and admin approval.
"""

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import PartnerProfile, User
from app.db.models.enums import PartnerApplicationStatus, UserRole
from app.schemas.partner import PartnerRegisterRequest, PartnerUpdateRequest


def list_approved_partners(db: Session, skip: int = 0, limit: int = 20) -> dict:
    """Return paginated list of approved, active partners."""
    query = (
        db.query(PartnerProfile, User)
        .join(User, User.id == PartnerProfile.id)
        .filter(
            PartnerProfile.application_status == PartnerApplicationStatus.approved,
            User.is_active == True,
        )
        .offset(skip)
        .limit(limit)
    )
    results = query.all()

    total = (
        db.query(PartnerProfile)
        .filter(PartnerProfile.application_status == PartnerApplicationStatus.approved)
        .count()
    )

    partners = [
        {
            "id": partner.id,
            "name": user.name,
            "bio": partner.bio,
            "photo_url": partner.photo_url,
            "rating": partner.rating,
            "review_count": partner.review_count,
            "flat_number": user.flat_number,
        }
        for partner, user in results
    ]
    return {"partners": partners, "total": total, "skip": skip, "limit": limit}


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
    Create a PartnerProfile for an existing user (pending admin approval).
    Raises 409 if the user already has a partner profile.
    """
    existing = db.query(PartnerProfile).filter(PartnerProfile.id == user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Partner profile already exists for this user.",
        )

    profile = PartnerProfile(
        id=user.id,
        bio=request.bio,
        application_status=PartnerApplicationStatus.pending,
    )
    # Update user role to partner
    user.role = UserRole.partner
    user.updated_at = datetime.now(UTC)

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found."
        )

    if request.bio is not None:
        partner.bio = request.bio
    if request.photo_url is not None:
        partner.photo_url = request.photo_url
    if request.upi_id is not None:
        partner.upi_id = request.upi_id.strip() if request.upi_id else None
        partner.is_upi_verified = bool(partner.upi_id)
    if request.upi_account_name is not None:
        partner.upi_account_name = request.upi_account_name.strip() if request.upi_account_name else None

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
            PartnerProfile.application_status == PartnerApplicationStatus.pending,
            User.is_active == True,
        )
        .offset(skip)
        .limit(limit)
    )
    results = query.all()
    total = (
        db.query(PartnerProfile)
        .filter(PartnerProfile.application_status == PartnerApplicationStatus.pending)
        .count()
    )

    partners = [
        {
            "id": partner.id,
            "name": user.name,
            "email": user.email,
            "flat_number": user.flat_number,
        }
        for partner, user in results
    ]
    return {"partners": partners, "total": total}


def approve_partner(db: Session, partner_id: int) -> PartnerProfile:
    """Approve a pending partner (admin action)."""
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found."
        )
    partner.application_status = PartnerApplicationStatus.approved
    partner.updated_at = datetime.now(UTC)
    db.commit()
    return partner


def reject_partner(db: Session, partner_id: int) -> User:
    """Reject a pending partner — deactivates the user (admin action)."""
    user = db.query(User).filter(User.id == partner_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found."
        )

    # Also update partner profile application_status
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if partner:
        partner.application_status = PartnerApplicationStatus.rejected
        partner.updated_at = datetime.now(UTC)

    user.is_active = False
    user.updated_at = datetime.now(UTC)
    db.commit()
    return user
