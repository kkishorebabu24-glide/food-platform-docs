"""Tests for orders and delivery endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Menu, Order, User
from app.db.models.enums import OrderStatus, UserRole


def test_list_orders_resident(client: TestClient, resident_headers: dict):
    response = client.get("/api/v1/orders/", headers=resident_headers)
    assert response.status_code == 200
    data = response.json()
    assert "orders" in data
    assert isinstance(data["orders"], list)


def test_list_orders_partner(client: TestClient, partner_headers: dict):
    response = client.get("/api/v1/orders/", headers=partner_headers)
    assert response.status_code == 200
    data = response.json()
    assert "orders" in data
    assert isinstance(data["orders"], list)


def test_create_and_cancel_order(client: TestClient, resident_headers: dict, partner_headers: dict, db: Session):
    partner = User(name="Chef Test", email="cheforders@test.com", role=UserRole.partner, is_active=True)
    db.add(partner)
    db.commit()

    item = Menu(partner_id=partner.id, name="Paneer Tikka", category="veg", price=150.0, is_available=True, quantity=10)
    db.add(item)
    db.commit()

    # Place order
    payload = {
        "partner_id": partner.id,
        "items": [{"menu_id": item.id, "name": "Paneer Tikka", "quantity": 2, "price": 150.0}],
        "delivery_type": "doorstep",
        "notes": "Spicy please",
    }
    create_res = client.post("/api/v1/orders/", json=payload, headers=resident_headers)
    assert create_res.status_code == 201

    order_id = create_res.json()["id"]

    # Cancel order
    cancel_res = client.delete(f"/api/v1/orders/{order_id}", headers=resident_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"


def test_delivery_route_loads(client: TestClient, resident_headers: dict):
    # Resident checks delivery for an invalid order, should get 404 cleanly
    response = client.get("/api/v1/deliveries/orders/999", headers=resident_headers)
    assert response.status_code == 404


def test_self_order_blocked(client: TestClient, test_resident: User, resident_headers: dict, db: Session):
    """Test that a user cannot place an order to their own kitchen (resident_id == partner_id)."""
    # Create menu item belonging to this resident's ID
    item = Menu(partner_id=test_resident.id, name="Self Dish", category="veg", price=100.0, is_available=True, quantity=5)
    db.add(item)
    db.commit()

    payload = {
        "partner_id": test_resident.id,
        "items": [{"menu_id": item.id, "name": "Self Dish", "quantity": 1, "price": 100.0}],
    }
    response = client.post("/api/v1/orders/", json=payload, headers=resident_headers)
    assert response.status_code == 400
    assert "cannot place orders from their own kitchen" in response.json()["detail"].lower()


def test_order_portion_decrement_and_auto_disable(client: TestClient, resident_headers: dict, db: Session):
    """Test that placing an order decrements portion stock and auto-marks out of stock at 0."""
    partner = User(name="Portion Chef", email="portionchef@test.com", role=UserRole.partner, is_active=True)
    db.add(partner)
    db.commit()

    item = Menu(partner_id=partner.id, name="Limited Biryani", category="non-veg", price=200.0, is_available=True, quantity=2)
    db.add(item)
    db.commit()

    payload = {
        "partner_id": partner.id,
        "items": [{"menu_id": item.id, "name": "Limited Biryani", "quantity": 2, "price": 200.0}],
    }
    res = client.post("/api/v1/orders/", json=payload, headers=resident_headers)
    assert res.status_code == 201

    db.refresh(item)
    assert item.quantity == 0
    assert item.is_available is False


def test_order_bola_unauthorized_access_blocked(client: TestClient, resident_headers: dict, db: Session):
    """Test that resident A cannot view resident B's order details (BOLA / IDOR protection)."""
    from app.core.security import create_access_token
    # Create an order belonging to other_resident
    other_resident = User(name="Other Resident", email="otherresident@test.com", role=UserRole.resident, is_active=True)
    partner = User(name="Chef Rajesh", email="chefrax@test.com", role=UserRole.partner, is_active=True)
    db.add_all([other_resident, partner])
    db.commit()

    menu_item = Menu(partner_id=partner.id, name="Paneer Tikka", category="veg", price=150.0, is_available=True)
    db.add(menu_item)
    db.commit()

    other_token = create_access_token(other_resident.id, other_resident.role)
    other_headers = {"Authorization": f"Bearer {other_token}"}

    payload = {
        "partner_id": partner.id,
        "items": [{"menu_id": menu_item.id, "name": "Paneer Tikka", "quantity": 1, "price": 150.0}],
    }
    create_res = client.post("/api/v1/orders/", json=payload, headers=other_headers)
    assert create_res.status_code == 201
    order_id = create_res.json()["id"]

    # Now attempt to access this order using test_resident's credentials (resident_headers)
    unauth_res = client.get(f"/api/v1/orders/{order_id}", headers=resident_headers)
    assert unauth_res.status_code == 403
    assert "do not have permission" in unauth_res.json()["detail"].lower()


def test_cart_price_concurrency_guard(client: TestClient, resident_headers: dict, db: Session):
    """Test that checking out with a stale cart price is rejected when chef has edited dish price."""
    partner = User(name="Chef Concurrency", email="chefconc@test.com", role=UserRole.partner, is_active=True)
    db.add(partner)
    db.commit()

    item = Menu(partner_id=partner.id, name="Dum Biryani", category="non-veg", price=200.0, is_available=True, quantity=10)
    db.add(item)
    db.commit()

    # Chef updates the price to ₹240.0
    item.price = 240.0
    db.commit()

    # Resident checkout request has stale cart price ₹200.0
    stale_payload = {
        "partner_id": partner.id,
        "items": [{"menu_id": item.id, "name": "Dum Biryani", "quantity": 1, "price": 200.0}],
    }
    res = client.post("/api/v1/orders/", json=stale_payload, headers=resident_headers)
    assert res.status_code == 400
    assert "has been updated by the chef" in res.json()["detail"]
    assert "200.00" in res.json()["detail"]
    assert "240.00" in res.json()["detail"]


def test_menu_item_spice_level_and_edit(client: TestClient, test_partner: User, partner_headers: dict, db: Session):
    """Test creating and updating a menu item with custom spice level."""
    from app.db.models import PartnerProfile
    prof = db.query(PartnerProfile).filter(PartnerProfile.id == test_partner.id).first()
    if not prof:
        prof = PartnerProfile(id=test_partner.id, is_open=True)
        db.add(prof)
        db.commit()

    # 1. Create with spice_level='hot'
    create_payload = {
        "name": "Fiery Kolhapuri Chicken",
        "category": "non-veg",
        "price": 250.0,
        "spice_level": "hot",
        "quantity": 10,
    }
    create_res = client.post("/api/v1/menus/", json=create_payload, headers=partner_headers)
    assert create_res.status_code == 201
    menu_id = create_res.json()["id"]

    # Verify spice_level in get_partner_menus
    get_res = client.get(f"/api/v1/menus/partners/{test_partner.id}")
    assert get_res.status_code == 200
    items = get_res.json()["items"]
    created_item = next(it for it in items if it["id"] == menu_id)
    assert created_item["spice_level"] == "hot"

    # 2. Update to spice_level='mild'
    update_payload = {
        "name": "Mild Kolhapuri Chicken",
        "price": 260.0,
        "spice_level": "mild",
        "quantity": 8,
    }
    update_res = client.put(f"/api/v1/menus/{menu_id}", json=update_payload, headers=partner_headers)
    assert update_res.status_code == 200

    # Verify updated spice_level
    get_res_updated = client.get(f"/api/v1/menus/partners/{test_partner.id}")
    updated_item = next(it for it in get_res_updated.json()["items"] if it["id"] == menu_id)
    assert updated_item["name"] == "Mild Kolhapuri Chicken"
    assert updated_item["price"] == 260.0
    assert updated_item["spice_level"] == "mild"



