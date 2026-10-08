"""Seller schemas — backward compatibility shim pointing to partner schemas."""

from app.schemas.partner import PartnerDetailResponse
from app.schemas.partner import PartnerDetailResponse as SellerDetailResponse
from app.schemas.partner import PartnerRegisterRequest
from app.schemas.partner import PartnerRegisterRequest as SellerRegisterRequest
from app.schemas.partner import PartnerResponse
from app.schemas.partner import PartnerResponse as SellerResponse
from app.schemas.partner import PartnerUpdateRequest
from app.schemas.partner import PartnerUpdateRequest as SellerUpdateRequest

__all__ = [
    "SellerDetailResponse",
    "SellerRegisterRequest",
    "SellerResponse",
    "SellerUpdateRequest",
    "PartnerDetailResponse",
    "PartnerRegisterRequest",
    "PartnerResponse",
    "PartnerUpdateRequest",
]
