"""Negative authorization tests for the resident/partner/admin role model."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.db.models import User
from app.db.models.enums import PartnerApplicationStatus, PartnerStatus, UserRole
from app.db.models.partner_profile import PartnerProfile


def _user(db: Session, email: str, role: UserRole, **kwargs) -> User:
    user = User(
        name=email.split("@")[0],
        email=email,
        hashed_password=hash_password("password123"),
        role=role,
        is_active=True,
        **kwargs,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def _apply(client: TestClient, user: User) -> None:
    res = client.post(
        "/api/v1/partners/register", json={"bio": "Home chef"}, headers=_headers(user)
    )
    assert res.status_code == 201, res.text


# ── Registration / sign-in cannot grant privileged roles ─────────────────────


def test_register_rejects_admin_and_super_admin_roles(client: TestClient):
    for role in ("admin", "super_admin", "tester"):
        res = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Mallory",
                "email": f"{role}@evil.io",
                "password": "password123",
                "role": role,
            },
        )
        assert res.status_code == 422, (role, res.text)


def test_register_as_partner_creates_resident_without_partner_access(
    client: TestClient,
):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Eve",
            "email": "eve@x.io",
            "password": "password123",
            "role": "seller",
        },
    )
    assert res.status_code == 201
    assert res.json()["role"] == "resident"

    login = client.post("/api/v1/auth/login", json={"email": "eve@x.io", "password": "password123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/v1/admin/residents", headers=headers).status_code == 403
    assert client.get("/api/v1/partners/me/orders", headers=headers).status_code == 403


def test_otp_cannot_create_admin(client: TestClient):
    res = client.post("/api/v1/auth/otp/request", json={"email": "otp-admin@x.io", "role": "admin"})
    assert res.status_code == 422
    res = client.post(
        "/api/v1/auth/otp/verify",
        json={"email": "otp-admin@x.io", "otp": "123456", "role": "admin"},
    )
    assert res.status_code == 422


def test_otp_partner_preference_does_not_bypass_approval(client: TestClient, db: Session):
    email = "otp-partner@x.io"
    otp = client.post("/api/v1/auth/otp/request", json={"email": email}).json()["dev_otp"]
    res = client.post(
        "/api/v1/auth/otp/verify", json={"email": email, "otp": otp, "role": "partner"}
    )
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "resident"
    user = db.query(User).filter_by(email=email).one()
    assert user.partner_profile is None


# ── Workspace switching ──────────────────────────────────────────────────────


def test_unapproved_resident_cannot_switch_to_partner(
    client: TestClient, db: Session, test_resident: User, resident_headers: dict
):
    res = client.post(
        "/api/v1/auth/switch-role",
        json={"target_role": "partner"},
        headers=resident_headers,
    )
    assert res.status_code == 403
    res = client.post("/api/v1/auth/switch-role", headers=resident_headers)
    assert res.status_code == 403
    db.refresh(test_resident)
    assert test_resident.role == UserRole.resident
    assert test_resident.partner_profile is None


def test_pending_applicant_cannot_switch_until_approved(client: TestClient, db: Session):
    applicant = _user(db, "applicant@x.io", UserRole.resident)
    admin = _user(db, "admin1@x.io", UserRole.admin)
    _apply(client, applicant)
    db.refresh(applicant)
    assert applicant.role == UserRole.resident
    assert applicant.partner_profile.application_status == PartnerApplicationStatus.pending

    switch = {"json": {"target_role": "partner"}, "headers": _headers(applicant)}
    assert client.post("/api/v1/auth/switch-role", **switch).status_code == 403

    res = client.post(f"/api/v1/admin/partners/{applicant.id}/approve", headers=_headers(admin))
    assert res.status_code == 200
    db.refresh(applicant)
    assert applicant.partner_profile.partner_status == PartnerStatus.active

    res = client.post("/api/v1/auth/switch-role", **switch)
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "partner"


def test_invalid_switch_target_rejected(client: TestClient, resident_headers: dict):
    res = client.post(
        "/api/v1/auth/switch-role",
        json={"target_role": "admin"},
        headers=resident_headers,
    )
    assert res.status_code == 422


def test_admin_and_super_admin_cannot_be_demoted_by_switch(client: TestClient, db: Session):
    for role in (UserRole.admin, UserRole.super_admin):
        user = _user(db, f"{role.value}-switch@x.io", role)
        for body in (None, {"target_role": "partner"}, {"target_role": "resident"}):
            res = client.post("/api/v1/auth/switch-role", json=body, headers=_headers(user))
            assert res.status_code == 403
        login = client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": "password123", "role": "resident"},
        )
        assert login.json()["user"]["role"] == role.value
        db.refresh(user)
        assert user.role == role


# ── Admin hierarchy ──────────────────────────────────────────────────────────


def test_super_admin_has_admin_access(client: TestClient, db: Session):
    super_admin = _user(db, "root@x.io", UserRole.super_admin)
    assert client.get("/api/v1/admin/residents", headers=_headers(super_admin)).status_code == 200
    assert (
        client.get("/api/v1/admin/partners/pending", headers=_headers(super_admin)).status_code
        == 200
    )


def test_residents_and_partners_denied_admin_routes(
    client: TestClient, resident_headers: dict, partner_headers: dict
):
    for headers in (resident_headers, partner_headers):
        assert client.get("/api/v1/admin/residents", headers=headers).status_code == 403
        assert client.post("/api/v1/admin/partners/1/approve", headers=headers).status_code == 403


def test_admin_cannot_deactivate_super_admin(client: TestClient, db: Session):
    admin = _user(db, "admin2@x.io", UserRole.admin)
    root = _user(db, "root2@x.io", UserRole.super_admin)
    res = client.patch(
        f"/api/v1/admin/users/{root.id}/status",
        json={"is_active": False},
        headers=_headers(admin),
    )
    assert res.status_code == 403
    res = client.patch(
        f"/api/v1/admin/users/{admin.id}/status",
        json={"is_active": False},
        headers=_headers(root),
    )
    assert res.status_code == 200


# ── Partner gating ───────────────────────────────────────────────────────────


def test_partner_role_without_approved_profile_is_denied(client: TestClient, db: Session):
    """A stale/forged partner role without an approved profile cannot use partner APIs."""
    for status in (
        PartnerApplicationStatus.pending,
        PartnerApplicationStatus.rejected,
        None,
    ):
        user = _user(db, f"ghost-{status}@x.io", UserRole.partner)
        if status is not None:
            db.add(PartnerProfile(id=user.id, application_status=status))
            db.commit()
        headers = _headers(user)
        assert client.get("/api/v1/partners/me/orders", headers=headers).status_code == 403
        assert client.get("/api/v1/sellers/me/orders", headers=headers).status_code == 403
        res = client.post(
            "/api/v1/menus/",
            json={"name": "Dosa", "category": "veg", "price": 50, "quantity": 5},
            headers=headers,
        )
        assert res.status_code == 403


def test_suspended_partner_is_denied(
    client: TestClient, db: Session, test_partner: User, partner_headers: dict
):
    assert client.get("/api/v1/partners/me/orders", headers=partner_headers).status_code == 200
    test_partner.partner_profile.partner_status = PartnerStatus.suspended
    db.commit()
    assert client.get("/api/v1/partners/me/orders", headers=partner_headers).status_code == 403


def test_rejected_applicant_keeps_resident_access_and_can_reapply(client: TestClient, db: Session):
    applicant = _user(db, "rejected@x.io", UserRole.resident)
    admin = _user(db, "admin3@x.io", UserRole.admin)
    _apply(client, applicant)

    res = client.post(f"/api/v1/admin/partners/{applicant.id}/reject", headers=_headers(admin))
    assert res.status_code == 200
    db.refresh(applicant)
    assert applicant.is_active is True
    assert applicant.role == UserRole.resident
    assert applicant.partner_profile.application_status == PartnerApplicationStatus.rejected
    assert applicant.partner_profile.partner_status == PartnerStatus.inactive

    headers = _headers(applicant)
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.get("/api/v1/orders/", headers=headers).status_code == 200
    app_state = client.get("/api/v1/partners/me/application", headers=headers).json()
    assert app_state["application_status"] == "rejected"

    _apply(client, applicant)
    db.refresh(applicant)
    assert applicant.partner_profile.application_status == PartnerApplicationStatus.pending


def test_rejecting_active_partner_returns_them_to_resident(
    client: TestClient, db: Session, test_partner: User
):
    admin = _user(db, "admin4@x.io", UserRole.admin)
    res = client.post(f"/api/v1/admin/partners/{test_partner.id}/reject", headers=_headers(admin))
    assert res.status_code == 200
    db.refresh(test_partner)
    assert test_partner.role == UserRole.resident
    assert test_partner.is_active is True


def test_public_partner_listing_only_shows_active_approved(
    client: TestClient, db: Session, test_partner: User
):
    pending = _user(db, "pending-list@x.io", UserRole.resident)
    _apply(client, pending)
    ids = {p["id"] for p in client.get("/api/v1/partners/").json()["partners"]}
    assert test_partner.id in ids
    assert pending.id not in ids
    legacy = client.get("/api/v1/sellers/").json()
    assert {p["id"] for p in legacy["sellers"]} == ids


def test_admin_cannot_apply_as_partner(client: TestClient, db: Session):
    admin = _user(db, "admin5@x.io", UserRole.admin)
    res = client.post("/api/v1/partners/register", json={"bio": "x"}, headers=_headers(admin))
    assert res.status_code == 403
