"""Tests for pre-orders configuration and placement."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.models import PartnerProfile, User
from app.db.models.enums import PartnerApplicationStatus, UserRole


def test_create_preorder_menu_and_place_preorder(client: TestClient, db: Session, test_resident: User, resident_headers: dict):
    # 1. Setup partner
    partner_user = User(
        name="Chef Sharma",
        email="chefsharma@test.com",
        role=UserRole.partner,
        is_active=True,
    )
    db.add(partner_user)
    db.commit()
    partner_prof = PartnerProfile(
        id=partner_user.id,
        bio="North Indian Specials",
        upi_id="chefsharma@okaxis",
        application_status=PartnerApplicationStatus.approved,
    )
    db.add(partner_prof)
    db.commit()

    partner_token = create_access_token(partner_user.id, "partner")
    partner_headers = {"Authorization": f"Bearer {partner_token}"}

    # 2. Chef creates Pre-Order Item
    menu_res = client.post(
        "/api/v1/menus/",
        headers=partner_headers,
        json={
            "name": "Dal Makhani & Butter Naan Combo",
            "description": "Slow cooked black lentils for tonight's dinner",
            "category": "veg",
            "price": 180.0,
            "is_preorder_only": True,
            "preorder_cutoff_time": "17:00",
            "available_slots": ["dinner_today", "dinner_tomorrow"],
            "max_batch_quantity": 25,
            "min_lead_time_hours": 3,
        },
    )
    assert menu_res.status_code == 201
    menu_data = menu_res.json()
    menu_id = menu_data["id"]

    # 3. Resident fetches partner menu and verifies pre-order fields
    menu_list_res = client.get(f"/api/v1/menus/partners/{partner_user.id}")
    assert menu_list_res.status_code == 200
    items = menu_list_res.json()["items"]
    combo_item = next(i for i in items if i["id"] == menu_id)
    assert combo_item["is_preorder_only"] is True
    assert combo_item["preorder_cutoff_time"] == "17:00"
    assert "dinner_today" in combo_item["available_slots"]

    # 4. Resident places a scheduled Pre-Order
    order_res = client.post(
        "/api/v1/orders/",
        headers=resident_headers,
        json={
            "partner_id": partner_user.id,
            "items": [{"menu_id": menu_id, "name": combo_item["name"], "quantity": 2, "price": 180.0}],
            "notes": "Please deliver hot at 8 PM",
            "is_preorder": True,
            "delivery_slot": "dinner_today",
            "target_delivery_date": "2026-08-30",
            "delivery_type": "doorstep",
        },
    )
    assert order_res.status_code == 201
    order_data = order_res.json()
    assert order_data["is_preorder"] is True
    assert order_data["delivery_slot"] == "dinner_today"
    assert order_data["delivery_type"] == "doorstep"
    assert order_data["total_price"] == 360.0
