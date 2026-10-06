"""Resident request/response schemas."""

from datetime import datetime

from pydantic import BaseModel


class ResidentProfileResponse(BaseModel):
    """Response schema for a resident's own profile."""

    id: int
    name: str
    email: str
    phone: str | None = None
    flat_number: str | None = None
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ResidentProfileUpdate(BaseModel):
    """Request body for updating a resident's own profile."""

    name: str | None = None
    phone: str | None = None
    flat_number: str | None = None
