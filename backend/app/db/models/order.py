from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, Boolean, Date, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import DeliveryType, OrderStatus

if TYPE_CHECKING:
    from app.db.models.payment import Payment
    from app.db.models.user import User


class Order(TimestampMixin, Base):
    """
    Represents an order placed by a resident.

    `items` is a JSON column containing an array of order line items:
      [{"menu_id": 1, "name": "Dal", "quantity": 2, "price": 80.0}, ...]
    """

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    resident_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    partner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    # Lifecycle: placed → accepted → preparing → ready → dispatched → in_transit → delivered | cancelled
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="orderstatus", create_constraint=True),
        nullable=False,
        default=OrderStatus.placed,
    )

    # JSON array of order line items (stored natively in PostgreSQL)
    items: Mapped[Any] = mapped_column(JSON, nullable=False)

    # Exact decimal total (2dp precision)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Optional resident note to the partner
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Pre-Order & Fulfillment Fields ─────────────────────────────────────────
    # Whether this order is a scheduled pre-order batch
    is_preorder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Delivery/Pickup slot (e.g. "lunch_today", "dinner_today", "12:30 PM - 1:30 PM")
    delivery_slot: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Target scheduled date for pre-order delivery/pickup
    target_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Fulfillment mode: doorstep delivery to flat vs self-pickup
    delivery_type: Mapped[DeliveryType] = mapped_column(
        SAEnum(DeliveryType, name="deliverytype", create_constraint=True),
        nullable=False,
        default=DeliveryType.doorstep,
    )

    # Set when status transitions to 'delivered'
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    resident: Mapped["User"] = relationship(
        "User", back_populates="orders_as_resident", foreign_keys=[resident_id]
    )
    partner: Mapped["User"] = relationship(
        "User", back_populates="orders_as_partner", foreign_keys=[partner_id]
    )
    payment: Mapped[Optional["Payment"]] = relationship(
        "Payment", back_populates="order", uselist=False
    )

    def __init__(self, **kwargs):
        if "seller_id" in kwargs and "partner_id" not in kwargs:
            kwargs["partner_id"] = kwargs.pop("seller_id")
        if "buyer_id" in kwargs and "resident_id" not in kwargs:
            kwargs["resident_id"] = kwargs.pop("buyer_id")
        super().__init__(**kwargs)

    # ── Convenience Properties (backward compatibility) ───────────────────────
    @property
    def seller_id(self) -> int:
        return self.partner_id

    @seller_id.setter
    def seller_id(self, val: int):
        self.partner_id = val

    @property
    def buyer_id(self) -> int:
        return self.resident_id

    @buyer_id.setter
    def buyer_id(self, val: int):
        self.resident_id = val

    # ── Validators ────────────────────────────────────────────────────────────

    @validates("total_price")
    def validate_total_price(self, key: str, value) -> Decimal:
        """Total price must be positive."""
        val = Decimal(str(value))
        if val <= 0:
            raise ValueError("Order total_price must be greater than zero")
        return val
