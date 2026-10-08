"""Buyer schemas — backward compatibility shim pointing to resident schemas."""

from app.schemas.resident import ResidentProfileResponse
from app.schemas.resident import ResidentProfileResponse as BuyerProfileResponse
from app.schemas.resident import ResidentProfileUpdate
from app.schemas.resident import ResidentProfileUpdate as BuyerProfileUpdate

__all__ = [
    "BuyerProfileResponse",
    "BuyerProfileUpdate",
    "ResidentProfileResponse",
    "ResidentProfileUpdate",
]
