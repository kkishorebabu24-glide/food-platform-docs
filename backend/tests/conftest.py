"""Pytest configuration and shared fixtures."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.dependencies import get_db
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.models import User
from app.db.models.enums import PartnerApplicationStatus, PartnerStatus, UserRole
from app.db.models.partner_profile import PartnerProfile
from app.main import app

# Use in-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db(setup_db) -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_resident(db: Session) -> User:
    user = User(
        name="Test Resident",
        email="resident@test.com",
        hashed_password=hash_password("password123"),
        role=UserRole.resident,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def resident_token(test_resident: User) -> str:
    return create_access_token(test_resident.id, str(test_resident.role))


@pytest.fixture
def resident_headers(resident_token: str) -> dict:
    return {"Authorization": f"Bearer {resident_token}"}


@pytest.fixture
def test_partner(db: Session) -> User:
    user = User(
        name="Test Partner",
        email="partner_fixture@test.com",
        hashed_password=hash_password("password123"),
        role=UserRole.partner,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.add(
        PartnerProfile(
            id=user.id,
            is_open=True,
            application_status=PartnerApplicationStatus.approved,
            partner_status=PartnerStatus.active,
        )
    )
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def partner_token(test_partner: User) -> str:
    return create_access_token(test_partner.id, str(test_partner.role))


@pytest.fixture
def partner_headers(partner_token: str) -> dict:
    return {"Authorization": f"Bearer {partner_token}"}
