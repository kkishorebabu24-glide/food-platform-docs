"""
Schemas package \u2014 exports all Pydantic request/response models.

Import from here for a clean, single namespace:
  from app.schemas import RegisterRequest, TokenResponse, OrderResponse
"""

from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    TokenResponse,
    UserInfo,
)
from app.schemas.menu import (
    AvailabilityRequest,
    MenuCreateRequest,
    MenuItemResponse,
    MenuUpdateRequest,
)
from app.schemas.order import OrderCreateRequest, OrderItem, OrderResponse, OrderStatusUpdate
from app.schemas.partner import (
    PartnerDetailResponse,
    PartnerRegisterRequest,
    PartnerResponse,
    PartnerUpdateRequest,
)
from app.schemas.payment import (
    LedgerEntryResponse,
    PartnerBalanceResponse,
    PaymentCaptureRequest,
    PaymentInitiateResponse,
    PaymentResponse,
)
from app.schemas.payout import (
    PayoutConfirmRequest,
    PayoutFailRequest,
    PayoutInitiateRequest,
    PayoutResponse,
)
from app.schemas.rating import RatingCreateRequest, RatingResponse
from app.schemas.resident import ResidentProfileResponse, ResidentProfileUpdate
from app.schemas.suggestion import (
    SuggestionClaimRequest,
    SuggestionCreateRequest,
    SuggestionResponse,
    UpvoteResponse,
)

__all__ = [
    "AvailabilityRequest",
    # Resident
    "ResidentProfileResponse",
    "ResidentProfileUpdate",
    "LedgerEntryResponse",
    "LoginRequest",
    # Menu
    "MenuCreateRequest",
    "MenuItemResponse",
    "MenuUpdateRequest",
    "OrderCreateRequest",
    # Order
    "OrderItem",
    "OrderResponse",
    "OrderStatusUpdate",
    "PaymentCaptureRequest",
    # Payment
    "PaymentInitiateResponse",
    "PaymentResponse",
    "PayoutConfirmRequest",
    "PayoutFailRequest",
    # Payout
    "PayoutInitiateRequest",
    "PayoutResponse",
    # Rating
    "RatingCreateRequest",
    "RatingResponse",
    "RefreshRequest",
    "RefreshResponse",
    # Auth
    "RegisterRequest",
    "PartnerBalanceResponse",
    "PartnerDetailResponse",
    # Partner
    "PartnerRegisterRequest",
    "PartnerResponse",
    "PartnerUpdateRequest",
    # Suggestion
    "SuggestionClaimRequest",
    "SuggestionCreateRequest",
    "SuggestionResponse",
    "TokenResponse",
    "UpvoteResponse",
    "UserInfo",
]
