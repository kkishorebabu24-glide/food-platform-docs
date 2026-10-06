"""Seller schemas — backward compatibility shim pointing to partner schemas."""

from app.schemas.partner import (
    PartnerDetailResponse as SellerDetailResponse,
    PartnerRegisterRequest as SellerRegisterRequest,
    PartnerResponse as SellerResponse,
    PartnerUpdateRequest as SellerUpdateRequest,
    PartnerDetailResponse,
    PartnerRegisterRequest,
    PartnerResponse,
    PartnerUpdateRequest,
)

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

