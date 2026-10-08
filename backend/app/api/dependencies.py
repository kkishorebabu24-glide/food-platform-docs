"""
FastAPI dependencies used across all route handlers.

This is the canonical place to import get_db, get_current_user, and role guards.
Keeping these here (rather than in app.core.security) avoids circular imports,
since these functions depend on app.db.session and app.db.models.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import User
from app.db.models.enums import PartnerApplicationStatus, PartnerStatus, UserRole
from app.db.session import get_db

# Re-export get_db so routes only need to import from here
__all__ = [
    "get_current_user",
    "get_db",
    "is_approved_partner",
    "normalize_role",
    "require_admin",
    "require_role",
]

bearer_scheme = HTTPBearer(auto_error=False)

DB_DEPENDENCY = Depends(get_db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = DB_DEPENDENCY,
) -> User:
    """
    FastAPI dependency — decodes the Bearer JWT and returns the authenticated User.

    Raises HTTP 401 if:
      - No Authorization header provided
      - Token is invalid or expired
      - User is not found or is inactive
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(user_id), User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


ROLE_ALIASES = {"seller": UserRole.partner.value, "buyer": UserRole.resident.value}
ADMIN_ROLES = frozenset({UserRole.admin.value, UserRole.super_admin.value})


def normalize_role(role: object) -> str:
    """Return the canonical role string, mapping legacy buyer/seller aliases."""
    value = str(getattr(role, "value", role))
    return ROLE_ALIASES.get(value, value)


def is_approved_partner(user: User) -> bool:
    """True when the user has an admin-approved, operational partner profile."""
    profile = user.partner_profile
    return bool(
        profile
        and profile.application_status == PartnerApplicationStatus.approved
        and profile.partner_status == PartnerStatus.active
    )


def require_role(*roles: str):
    """
    Dependency factory for role-based access control.

    - Legacy ``buyer``/``seller`` names are accepted as aliases.
    - ``super_admin`` inherits every ``admin`` permission.
    - The ``partner`` role is only honoured for users whose partner application
      has been approved by an admin and whose partner account is active.

    Usage:
        @router.post("/menu")
        def add_menu(user: User = Depends(require_role("partner", "admin"))):
            ...
    """
    allowed_roles = {normalize_role(r) for r in roles}
    if UserRole.admin.value in allowed_roles:
        allowed_roles.add(UserRole.super_admin.value)
    label = ", ".join(sorted({normalize_role(r) for r in roles}))

    def role_guard(current_user: User = Depends(get_current_user)) -> User:
        user_role = normalize_role(current_user.role)
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {label}",
            )
        if user_role == UserRole.partner.value and not is_approved_partner(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Partner access requires an approved and active partner profile.",
            )
        return current_user

    # Give the inner function a unique name to help FastAPI's dependency cache
    role_guard.__name__ = f"require_{'_or_'.join(sorted(allowed_roles))}"
    return role_guard


def require_admin(current_user: User = Depends(require_role("admin"))) -> User:
    """Shortcut dependency for admin / super_admin only endpoints."""
    return current_user
