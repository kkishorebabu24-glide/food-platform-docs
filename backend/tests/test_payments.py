"""Tests for payment endpoints."""

from fastapi.testclient import TestClient
from app.db.models import User

def test_ledger_route(client: TestClient, test_resident: User):
    # test_resident has role=resident, so they shouldn't access ledger
    from app.core.security import create_access_token
    token = create_access_token(test_resident.id, "resident")
    response = client.get("/api/v1/payments/ledger/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_balance_route(client: TestClient, db):
    from app.core.security import create_access_token
    from app.db.models import User, PartnerProfile
    from app.db.models.enums import UserRole, PartnerApplicationStatus

    partner_user = User(name="Payment Chef", email="paychef@test.com", role=UserRole.partner, is_active=True)
    db.add(partner_user)
    db.commit()
    partner_prof = PartnerProfile(id=partner_user.id, bio="Chef", application_status=PartnerApplicationStatus.approved)
    db.add(partner_prof)
    db.commit()

    token = create_access_token(partner_user.id, "partner")
    response = client.get("/api/v1/payments/balance/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "balance" in response.json()


