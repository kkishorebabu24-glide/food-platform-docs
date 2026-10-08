"""PartnerProfile model — extended profile for users with role=partner."""

import re
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import PartnerApplicationStatus, PartnerStatus

if TYPE_CHECKING:
    from app.db.models.menu import Menu
    from app.db.models.rating import Rating
    from app.db.models.user import User


class PartnerProfile(TimestampMixin, Base):
    """
    One-to-one extension of User for partners.

    Uses the User's primary key as both PK and FK so a PartnerProfile
    can only exist for an existing User with role=partner.
    """

    __tablename__ = "partner_profiles"

    # Uses the User's primary key as both PK and FK
    id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)

    # Partner bio — text area in UI describing what products they supply
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Payment Details (Direct P2PM UPI) ─────────────────────────────────────
    # Store encrypted in production; plaintext acceptable for MVP
    bank_account: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upi_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upi_account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_upi_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── SaaS Pass Quota & Platform Maintenance ────────────────────────────────
    # First 50 completed orders are 100% free; subsequent orders charged ₹5 maintenance fee
    free_orders_remaining: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    maintenance_balance: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    lifetime_orders_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Profile photo URL (CDN / S3 link)
    # Profile photo URL (CDN / S3 link or local upload)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Kitchen background banner URL or preset
    banner_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Multi-photo kitchen & partner gallery (list of image URLs)
    photos: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # ── Aggregate Rating (Customer Reviews) ───────────────────────────────────
    # Rating 1–5 with 0.2 precision; updated by rating_service after each review
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── Punctuality & Reliability Metrics (Automated) ─────────────────────────
    # Computed from completed order timestamps vs. estimated/slot deadlines
    on_time_delivery_rate: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    punctuality_rating: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    avg_delivery_minutes: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    total_orders_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── Availability ──────────────────────────────────────────────────────────
    # Partners can toggle themselves open/closed without affecting menus or approval.
    # Residents only see open partners; closed partners cannot receive new orders.
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Admin Approval ────────────────────────────────────────────────────────
    # Partners are only visible to residents after admin approval
    application_status: Mapped[PartnerApplicationStatus] = mapped_column(
        SAEnum(PartnerApplicationStatus, name="approvalstatus", create_constraint=True),
        nullable=False,
        default=PartnerApplicationStatus.pending,
    )

    partner_status: Mapped["PartnerStatus"] = mapped_column(
        SAEnum(PartnerStatus, name="partnerstatus", create_constraint=True),
        nullable=False,
        default=PartnerStatus.pending,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="partner_profile")
    menus: Mapped[list["Menu"]] = relationship("Menu", back_populates="partner")
    ratings: Mapped[list["Rating"]] = relationship("Rating", back_populates="partner")

    def __init__(self, **kwargs):
        if "approval_status" in kwargs and "application_status" not in kwargs:
            kwargs["application_status"] = kwargs.pop("approval_status")
        super().__init__(**kwargs)

    # ── Convenience Property (backward compatibility) ─────────────────────────
    @property
    def approval_status(self) -> PartnerApplicationStatus:
        return self.application_status

    @approval_status.setter
    def approval_status(self, val: PartnerApplicationStatus):
        self.application_status = val

    @property
    def is_approved(self) -> bool:
        """True when application_status is 'approved'. Read-only shortcut."""
        return self.application_status == PartnerApplicationStatus.approved

    # ── Validators ────────────────────────────────────────────────────────────

    @validates("upi_id")
    def validate_upi_id(self, key: str, value: str | None) -> str | None:
        """Basic UPI ID format validation: localpart@bankhandle."""
        if value is not None and not re.fullmatch(r"[a-zA-Z0-9.\-_]+@[a-zA-Z]{3,}", value):
            raise ValueError("UPI ID format invalid (expected: handle@bank, e.g. john@paytm)")
        return value

    @validates("rating")
    def validate_rating(self, key: str, value: float) -> float:
        """Rating must be between 0.0 and 5.0."""
        if not (0.0 <= float(value) <= 5.0):
            raise ValueError("Rating must be between 0.0 and 5.0")
        return value
