"""Tests for Multimodal AI endpoints."""

from fastapi.testclient import TestClient

from app.db.models import Menu, User
from app.db.models.enums import UserRole


def test_analyze_dish_endpoint(client: TestClient, resident_headers: dict):
    payload = {
        "title": "Paneer Butter Masala",
        "description": "Rich creamy tomato gravy with cottage cheese cubes and mild spices.",
        "image_url": "https://example.com/paneer.jpg",
    }
    response = client.post("/api/v1/ai/analyze-dish", json=payload, headers=resident_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "dietary_tags" in data["data"]
    assert "100% Pure Veg" in data["data"]["dietary_tags"]
    assert "Dairy" in data["data"]["allergens"]
    assert data["data"]["estimated_calories_per_portion"] > 0


def test_meal_advisor_endpoint(client: TestClient, resident_headers: dict, db):
    partner_user = User(
        name="Test Chef", email="chefai@test.com", role=UserRole.partner, is_active=True
    )
    db.add(partner_user)
    db.commit()

    menu = Menu(
        partner_id=partner_user.id,
        name="Dal Tadka",
        category="veg",
        price=120.0,
        is_available=True,
    )
    db.add(menu)
    db.commit()

    payload = {
        "prompt": "I want something healthy and light for dinner",
        "preferences": ["vegetarian"],
    }
    response = client.post("/api/v1/ai/meal-advisor", json=payload, headers=resident_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "recommendations" in data["data"]
    assert len(data["data"]["recommendations"]) >= 1
