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


def test_login_user_with_role_switch(client: TestClient, db: Session, test_resident: User):
    """User registered as resident logs in and requests partner role."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "resident@test.com", "password": "password123", "role": "partner"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "partner"


def test_switch_role_endpoint(client: TestClient, resident_headers: dict):
    """Authenticated user switches active persona."""
    response = client.post(
        "/api/v1/auth/switch-role",
        json={"target_role": "partner"},
        headers=resident_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "partner"
    assert "access_token" in data

