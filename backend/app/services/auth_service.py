"""
Auth service — user registration, authentication, and lookup.

Routes call these functions instead of touching the DB directly,
keeping route handlers thin and business logic testable.
"""

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db.models import User
from app.db.models.enums import UserRole, UserStatus


def register_user(
    db: Session,
    email: str,
    name: str,
    password: str,
    role: str = "resident",
) -> User:
    """
    Register a new user with a hashed password.
    Raises HTTP 409 if email already exists.
    """
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    role_map = {"seller": "partner", "buyer": "resident"}
    normalized_role = role_map.get(role, role)

    user = User(
        email=email,
        name=name,
        role=UserRole(normalized_role),
        hashed_password=hash_password(password),
        status=UserStatus.pending_verification,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    """
    Verify credentials and return the user.
    Raises HTTP 401 on invalid credentials.
    Raises HTTP 403 if account is inactive.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact support.",
        )

    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    """Return a User by email, or None if not found."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Return a User by ID, or None if not found."""
    return db.query(User).filter(User.id == user_id).first()


def mark_user_verified(db: Session, user: User) -> User:
    """Mark a user as verified (called after OTP login or admin action)."""
    if user.status != UserStatus.active:
        user.status = UserStatus.active
        user.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
    return user


def find_or_create_user(
    db: Session,
    email: str,
    name: str,
    role: str,
) -> tuple[User, bool]:
    """
    Find an existing user by email or create a new one (used by seed scripts).
    Returns (user, created).
    """
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user, False

    user = User(
        email=email,
        name=name or email.split("@")[0],
        role=UserRole(role),
        status=UserStatus.active,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True
