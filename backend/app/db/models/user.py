"""User model -- residents, partners, and admins share this table (role-based)."""

import re
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import UserRole, UserStatus

if TYPE_CHECKING:
    from app.db.models.order import Order
    from app.db.models.partner_profile import PartnerProfile


class User(TimestampMixin, Base):
    """
    Represents any platform participant: resident, partner, or admin.

    Every society member starts as a resident. A resident can apply to become
    a partner (home chef), while still placing orders as a resident.
    """

    __tablename__ = "users"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    # Mandatory — displayed in UI
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Primary login identifier — must be unique
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    # 10-digit Indian mobile — optional, validated
    phone: Mapped[str | None] = mapped_column(String(15), nullable=True)

    # Society flat number e.g. "A-101", "TowerA-101" -- optional
    flat_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    # -- Role & Status ---------------------------------------------------------
    # Roles: resident | partner | admin | super_admin
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole", create_constraint=True),
        nullable=False,
        default=UserRole.resident,
    )

    # 5-state user lifecycle
    status: Mapped[UserStatus] = mapped_column(
        SAEnum(UserStatus, name="userstatus", create_constraint=True),
        nullable=False,
        default=UserStatus.pending_verification,
    )

    # Account active / inactive flag (mirrors status == active for quick queries)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Authentication ────────────────────────────────────────────────────────
    # Bcrypt-hashed password for JWT login
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # -- OTP Fields (nullable -- reserved for future email / phone OTP flow) ---
    otp_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    otp_attempts: Mapped[int] = mapped_column(default=0, nullable=False)

    # -- Relationships ---------------------------------------------------------
    partner_profile: Mapped[Optional["PartnerProfile"]] = relationship(
        "PartnerProfile", back_populates="user", uselist=False
    )
    orders_as_resident: Mapped[list["Order"]] = relationship(
        "Order", back_populates="resident", foreign_keys="Order.resident_id"
    )
    orders_as_partner: Mapped[list["Order"]] = relationship(
        "Order", back_populates="partner", foreign_keys="Order.partner_id"
    )

    # -- Convenience Properties ------------------------------------------------
    @property
    def is_verified(self) -> bool:
        """True when status is 'active'."""
        return self.status == UserStatus.active

    @property
    def is_partner(self) -> bool:
        """True when the user holds the partner role."""
        return self.role == UserRole.partner

    @property
    def is_seller(self) -> bool:
        """Backward compatibility alias for is_partner."""
        return self.role == UserRole.partner

    @property
    def is_buyer(self) -> bool:
        """Backward compatibility alias for resident."""
        return self.role == UserRole.resident

    @property
    def seller_profile(self):
        """Backward compatibility alias for partner_profile."""
        return self.partner_profile

    @property
    def is_admin(self) -> bool:
        """True when the user holds the admin or super_admin role."""
        return self.role in (UserRole.admin, UserRole.super_admin)

    # -- Validators ------------------------------------------------------------

    @validates("phone")
    def validate_phone(self, key: str, value: str | None) -> str | None:
        """Accept exactly 10 digits (Indian mobile numbers)."""
        if value is not None and not re.fullmatch(r"\d{10}", value):
            raise ValueError("Phone must be exactly 10 digits (e.g. 9876543210)")
        return value

    @validates("flat_number")
    def validate_flat_number(self, key: str, value: str | None) -> str | None:
        """Accept alphanumeric flat numbers with optional hyphens (e.g. A-101)."""
        if value is not None and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9\-]*", value):
            raise ValueError(
                "Flat number must be alphanumeric with optional hyphens (e.g. A-101)"
            )
        return value

    @validates("name")
    def validate_name(self, key: str, value: str) -> str:
        """Name must be non-empty after stripping whitespace."""
        if not value or not value.strip():
            raise ValueError("Name must not be empty")
        return value.strip()
