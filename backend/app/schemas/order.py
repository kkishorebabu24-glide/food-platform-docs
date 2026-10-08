"""Order request/response schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator, model_validator

from app.db.models.enums import OrderStatus

VALID_DELIVERY_TYPES = {"doorstep", "self_pickup"}
VALID_STATUSES = {s.value for s in OrderStatus}


class OrderItem(BaseModel):
    """A single line item within an order."""

    menu_id: int
    name: str
    quantity: int
    price: float


class OrderCreateRequest(BaseModel):
    """Request body for placing a new order."""

    partner_id: int | None = None
    seller_id: int | None = None
    items: list[OrderItem]
    notes: str | None = None
    is_preorder: bool = False
    delivery_slot: str | None = None
    target_delivery_date: str | None = None
    delivery_type: str = "doorstep"

    @model_validator(mode="before")
    @classmethod
    def populate_partner_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            p_id = data.get("partner_id")
            if p_id is None:
                p_id = data.get("seller_id")
            if p_id is None:
                raise ValueError("Either partner_id or seller_id must be provided")
            data["partner_id"] = p_id
            data["seller_id"] = p_id
        return data

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list) -> list:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v

    @field_validator("delivery_type")
    @classmethod
    def validate_delivery_type(cls, v: str) -> str:
        if v not in VALID_DELIVERY_TYPES:
            raise ValueError(
                f"delivery_type must be one of: {', '.join(sorted(VALID_DELIVERY_TYPES))}"
            )
        return v


class OrderStatusUpdate(BaseModel):
    """Request body for a partner updating order status."""

    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v


class OrderResponse(BaseModel):
    """Response schema for a single order."""

    id: int
    resident_id: int
    partner_id: int
    buyer_id: int | None = None
    seller_id: int | None = None
    status: str
    items: Any  # Parsed from JSON text
    total_price: float
    notes: str | None = None
    is_preorder: bool = False
    delivery_slot: str | None = None
    target_delivery_date: Any | None = None
    delivery_type: str = "doorstep"
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def populate_legacy_ids(self):
        if self.seller_id is None:
            self.seller_id = self.partner_id
        if self.buyer_id is None:
            self.buyer_id = self.resident_id
        return self
