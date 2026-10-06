"""Delivery model — tracks in-building food delivery from partner's flat to resident's flat.

Option A: Partner carries food to resident's door within the residential society.
No third-party courier. Simple lifecycle: pending → dispatched → delivered | failed.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.enums import DeliveryStatus

if TYPE_CHECKING:
    from app.db.models.order import Order
    from app.db.models.user import User


class Delivery(TimestampMixin, Base):
    """
    Tracks the in-building delivery of a completed order.

    One delivery per order (enforced by unique constraint on order_id).
    Created by the partner once an order is completed and they choose to deliver.

    Lifecycle:
        pending     → Delivery record created; partner has not left yet
        dispatched  → Partner picked up the food and is walking to resident's flat
        delivered   → Food handed to resident at their door
        failed      → Delivery could not be completed (resident absent, etc.)
    """

    __tablename__ = "deliveries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # One delivery per order
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), unique=True, index=True, nullable=False
    )

    # Parties involved
    partner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    resident_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # Delivery lifecycle status
    status: Mapped[DeliveryStatus] = mapped_column(
        SAEnum(DeliveryStatus, name="deliverystatus", create_constraint=True),
        nullable=False,
        default=DeliveryStatus.pending,
    )

    # ── Location Snapshots ────────────────────────────────────────────────────
    # Captured at delivery creation time so changing flat numbers doesn't break history
    partner_flat: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resident_flat: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Delivery Details ──────────────────────────────────────────────────────
    # Partner's estimated delivery time (e.g., 10 minutes)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Optional notes from partner (e.g., "Leaving at door", "Ring bell twice")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    # When the partner actually left to deliver
    dispatched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # When the food was handed to the resident
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    order: Mapped["Order"] = relationship("Order")
    partner: Mapped["User"] = relationship("User", foreign_keys=[partner_id])
    resident: Mapped["User"] = relationship("User", foreign_keys=[resident_id])
