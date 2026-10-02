"""Payment and ledger request/response schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class PaymentInitiateResponse(BaseModel):
    """Response after initiating a Razorpay order."""
    razorpay_order_id: str
    amount: int           # Amount in paise (INR)
    currency: str
    key_id: str
    payment_id: int       # Internal DB Payment.id
    order_id: int


class PaymentCaptureRequest(BaseModel):
    """Request body for confirming a Razorpay payment from the frontend."""
    provider_payment_id: str   # razorpay_payment_id from Razorpay callback
    provider_signature: str    # razorpay_signature from Razorpay callback


class DirectUPIInitiateResponse(BaseModel):
    """Response when generating a Direct P2PM UPI payment intent."""
    order_id: int
    amount: Decimal
    currency: str = "INR"
    partner_name: str
    partner_vpa: str
    upi_uri: str
    payment_id: int


class SubmitUTRRequest(BaseModel):
    """Request body for resident submitting 12-digit UPI UTR number."""
    utr_number: str


class PaymentResponse(BaseModel):
    """Full payment detail response."""
    id: int
    order_id: int
    resident_id: int
    partner_id: int
    amount: Decimal
    currency: str
    status: str
    provider: str
    provider_order_id: str | None = None
    provider_payment_id: str | None = None
    utr_number: str | None = None
    partner_confirmed_at: datetime | None = None
    failure_reason: str | None = None
    captured_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PartnerMaintenanceStatusResponse(BaseModel):
    """SaaS Pass quota and platform maintenance status for a partner."""
    partner_id: int
    free_orders_remaining: int
    free_orders_total: int
    maintenance_balance: Decimal
    lifetime_orders_count: int
    maintenance_fee_per_order: float
    platform_upi_vpa: str
    platform_upi_name: str
    is_availability_allowed: bool


class MaintenanceTopupRequest(BaseModel):
    """Request body for partner topping up maintenance credits."""
    amount: Decimal
    utr_number: str


class LedgerEntryResponse(BaseModel):
    """A single partner ledger entry."""
    id: int
    order_id: int
    entry_type: str
    amount: Decimal
    balance_after: Decimal
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PartnerBalanceResponse(BaseModel):
    """Partner's current ledger balance."""
    partner_id: int
    balance: Decimal
    currency: str = "INR"
