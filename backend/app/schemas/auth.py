"""Authentication request/response schemas."""

from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

ROLE_NORMALIZATION_MAP = {"seller": "partner", "buyer": "resident"}
# Roles a client may *request* (workspace preference). Privileged roles
# (admin, super_admin) are only ever granted out-of-band and never accepted here.
SELF_SERVICE_ROLES = {"resident", "partner"}
VALID_ROLES = SELF_SERVICE_ROLES | set(ROLE_NORMALIZATION_MAP)


def normalize_requested_role(v: str | None) -> str | None:
    """Normalize legacy aliases and reject privileged/unknown roles."""
    if v is None:
        return None
    mapped = ROLE_NORMALIZATION_MAP.get(v.strip().lower(), v.strip().lower())
    if mapped not in SELF_SERVICE_ROLES:
        raise ValueError("Role must be one of: resident, partner (or legacy buyer, seller)")
    return mapped


class RegisterRequest(BaseModel):
    """Request body for POST /api/v1/auth/register."""

    email: EmailStr
    password: str
    name: str
    role: str = "resident"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        return normalize_requested_role(v) or "resident"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name must not be empty")
        return v.strip()


class LoginRequest(BaseModel):
    """Request body for POST /api/v1/auth/login."""

    email: EmailStr
    password: str
    role: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str | None) -> str | None:
        return normalize_requested_role(v)


class RefreshRequest(BaseModel):
    """Request body for POST /api/v1/auth/refresh."""

    refresh_token: str


class UserInfo(BaseModel):
    """Embedded user data returned in the token response."""

    id: int
    email: str
    name: str
    role: str
    flat_number: str | None = None
    status: str
    is_verified: bool


class TokenResponse(BaseModel):
    """Response body for a successful login."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserInfo


class RefreshResponse(BaseModel):
    """Response for a successful token refresh."""

    access_token: str
    token_type: str = "bearer"


class OTPRequest(BaseModel):
    """Request body for requesting an OTP."""

    email: EmailStr
    role: str = "resident"
    channel: str = "email"  # "email" | "whatsapp"
    phone: str | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        return normalize_requested_role(v) or "resident"


class OTPVerifyRequest(BaseModel):
    """Request body for verifying an OTP and logging in."""

    email: EmailStr
    otp: str
    name: str | None = None
    role: str = "resident"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        return normalize_requested_role(v) or "resident"

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 4 or len(cleaned) > 10:
            raise ValueError("OTP must be between 4 and 10 digits")
        return cleaned


class OTPRequestResponse(BaseModel):
    """Response body after requesting an OTP."""

    message: str
    expires_in_minutes: int
    dev_otp: str | None = None
