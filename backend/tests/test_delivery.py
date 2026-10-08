"""Tests for delivery endpoints."""

from fastapi.testclient import TestClient


def test_get_my_deliveries_as_resident(client: TestClient, resident_headers: dict):
    # Only partner or admin can list their deliveries
    response = client.get("/api/v1/deliveries/me", headers=resident_headers)
    assert response.status_code == 403


def test_get_my_deliveries_as_partner(client: TestClient, db):
    from app.core.security import create_access_token
    from app.db.models import PartnerProfile, User
    from app.db.models.enums import PartnerApplicationStatus, PartnerStatus, UserRole

    partner_user = User(
        name="Delivery Chef",
        email="delivchef@test.com",
        role=UserRole.partner,
        is_active=True,
    )
    db.add(partner_user)
    db.commit()
    partner_prof = PartnerProfile(
        id=partner_user.id,
        bio="Chef",
        application_status=PartnerApplicationStatus.approved,
        partner_status=PartnerStatus.active,
    )
    db.add(partner_prof)
    db.commit()

    token = create_access_token(partner_user.id, "partner")
    response = client.get("/api/v1/deliveries/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "deliveries" in response.json()
