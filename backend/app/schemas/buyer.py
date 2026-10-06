"""Buyer schemas — backward compatibility shim pointing to resident schemas."""

from app.schemas.resident import (
    ResidentProfileResponse as BuyerProfileResponse,
    ResidentProfileUpdate as BuyerProfileUpdate,
    ResidentProfileResponse,
    ResidentProfileUpdate,
)

__all__ = [
    "BuyerProfileResponse",
    "BuyerProfileUpdate",
    "ResidentProfileResponse",
    "ResidentProfileUpdate",
]

