"""Tests for auth endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import User


def test_register_user(client: TestClient, db: Session):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "New User",
            "email": "newuser@test.com",
            "password": "strongpassword123",
            "role": "resident",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@test.com"


def test_login_user(client: TestClient, db: Session, test_resident: User):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "resident@test.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


def test_change_password(client: TestClient, resident_headers: dict):
    response = client.patch(
        "/api/v1/auth/me/password",
        json={
            "current_password": "password123",
            "new_password": "newpassword123",
        },
        headers=resident_headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Password changed successfully."


def test_login_role_preference_cannot_bypass_partner_approval(
    client: TestClient, db: Session, test_resident: User
):
    """A resident without an approved application stays a resident at login."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "resident@test.com",
            "password": "password123",
            "role": "partner",
        },
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "resident"
    db.refresh(test_resident)
    assert test_resident.partner_profile is None


def test_login_role_preference_for_approved_partner(
    client: TestClient, db: Session, test_partner: User
):
    """An approved partner can choose either workspace at login."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "partner_fixture@test.com",
            "password": "password123",
            "role": "buyer",
        },
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "resident"

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "partner_fixture@test.com",
            "password": "password123",
            "role": "seller",
        },
    )
    assert response.json()["user"]["role"] == "partner"


def test_switch_role_endpoint(client: TestClient, partner_headers: dict):
    """An approved partner switches between partner and resident workspaces."""
    response = client.post(
        "/api/v1/auth/switch-role",
        json={"target_role": "resident"},
        headers=partner_headers,
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "resident"

    response = client.post(
        "/api/v1/auth/switch-role",
        json={"target_role": "partner"},
        headers=partner_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "partner"
    assert "access_token" in data
