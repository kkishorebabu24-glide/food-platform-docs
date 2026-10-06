"""Tests for seller multi-photo uploads, banner management, and global dish search."""

import io
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.models import Menu, SellerProfile, User
from app.db.models.enums import ApprovalStatus, MenuCategory, UserRole


def test_seller_avatar_and_banner_upload(client: TestClient, db: Session):
    # 1. Setup seller user and approved profile
    seller_user = User(
        name="Chef Sunita",
        email="sunita@test.com",
        flat_number="B-301",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(seller_user)
    db.commit()

    seller_prof = SellerProfile(
        id=seller_user.id,
        bio="Traditional Rajasthani Thalis",
        upi_id="sunita@okhdfc",
        approval_status=ApprovalStatus.approved,
        is_open=True,
    )
    db.add(seller_prof)
    db.commit()

    seller_token = create_access_token(seller_user.id, "seller")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}

    # 2. Upload Chef Avatar photo
    fake_img = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 100)
    avatar_res = client.post(
        "/api/v1/sellers/me/photo",
        headers=seller_headers,
        files={"file": ("avatar.jpg", fake_img, "image/jpeg")},
    )
    assert avatar_res.status_code == 200
    assert "photo_url" in avatar_res.json()
    assert avatar_res.json()["photo_url"].startswith("/uploads/sellers/")

    # 3. Set Curated Banner Preset
    preset_url = "https://images.unsplash.com/photo-1556911220-e15b29be8c8f"
    banner_preset_res = client.post(
        "/api/v1/sellers/me/banner",
        headers=seller_headers,
        params={"preset_url": preset_url},
    )
    assert banner_preset_res.status_code == 200
    assert banner_preset_res.json()["banner_url"] == preset_url

    # 4. Upload Custom Banner image
    banner_img = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 150)
    banner_upload_res = client.post(
        "/api/v1/sellers/me/banner",
        headers=seller_headers,
        files={"file": ("kitchen_banner.jpg", banner_img, "image/jpeg")},
    )
    assert banner_upload_res.status_code == 200
    assert banner_upload_res.json()["banner_url"].startswith("/uploads/sellers/")
    assert "_banner.jpg" in banner_upload_res.json()["banner_url"]

    # 5. Verify public seller profile returns both photo_url and banner_url
    get_res = client.get(f"/api/v1/sellers/{seller_user.id}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["name"] == "Chef Sunita"
    assert data["photo_url"].startswith("/uploads/sellers/")
    assert "_banner.jpg" in data["banner_url"]


def test_seller_multi_photos_and_delete(client: TestClient, db: Session):
    # 1. Setup seller
    seller_user = User(
        name="Chef Anand",
        email="anand@test.com",
        flat_number="A-504",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(seller_user)
    db.commit()

    seller_prof = SellerProfile(
        id=seller_user.id,
        bio="Baking & Desserts",
        upi_id="anand@okicici",
        approval_status=ApprovalStatus.approved,
        is_open=True,
        photos=[],
    )
    db.add(seller_prof)
    db.commit()

    seller_token = create_access_token(seller_user.id, "seller")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}

    # 2. Upload multiple gallery photos
    img1 = ("files", ("dish1.jpg", io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x01" * 80), "image/jpeg"))
    img2 = ("files", ("dish2.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x02" * 80), "image/png"))

    upload_res = client.post(
        "/api/v1/sellers/me/photos",
        headers=seller_headers,
        files=[img1, img2],
    )
    assert upload_res.status_code == 200
    res_data = upload_res.json()
    assert len(res_data["photos"]) == 2
    photo1_url = res_data["photos"][0]
    photo2_url = res_data["photos"][1]

    # 3. Delete one photo from gallery
    delete_res = client.delete(
        "/api/v1/sellers/me/photos",
        headers=seller_headers,
        params={"photo_url": photo1_url},
    )
    assert delete_res.status_code == 200
    updated_photos = delete_res.json()["photos"]
    assert len(updated_photos) == 1
    assert photo1_url not in updated_photos
    assert photo2_url in updated_photos

    # 4. Verify public GET /sellers/ endpoint returns updated photos array
    list_res = client.get("/api/v1/sellers/")
    assert list_res.status_code == 200
    sellers = list_res.json()["sellers"]
    anand = next(s for s in sellers if s["id"] == seller_user.id)
    assert anand["photos"] == [photo2_url]


def test_public_dish_search_endpoint(client: TestClient, db: Session):
    # 1. Setup Seller 1 (Chef Kavita, C-202, pure veg items)
    user1 = User(
        name="Chef Kavita",
        email="kavita@test.com",
        flat_number="C-202",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(user1)
    db.commit()
    prof1 = SellerProfile(
        id=user1.id,
        bio="Authentic Maharashtrian delicacies",
        upi_id="kavita@okhdfc",
        approval_status=ApprovalStatus.approved,
        is_open=True,
        rating=4.9,
    )
    db.add(prof1)

    # 2. Setup Seller 2 (Chef Tariq, D-804, biryani specialist)
    user2 = User(
        name="Chef Tariq",
        email="tariq@test.com",
        flat_number="D-804",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(user2)
    db.commit()
    prof2 = SellerProfile(
        id=user2.id,
        bio="Royal Hyderabadi Dum Biryani and Kebabs",
        upi_id="tariq@okaxis",
        approval_status=ApprovalStatus.approved,
        is_open=True,
        rating=4.8,
    )
    db.add(prof2)
    db.commit()

    # 3. Add Dishes for Seller 1
    paneer = Menu(
        seller_id=user1.id,
        name="Paneer Butter Masala",
        description="Rich cashew and tomato gravy with cottage cheese",
        category=MenuCategory.veg,
        price=Decimal("190.00"),
        is_available=True,
        quantity=15,
        spice_level="mild",
    )
    jamun = Menu(
        seller_id=user1.id,
        name="Gulab Jamun (4 pcs)",
        description="Warm dessert dumplings soaked in saffron syrup",
        category=MenuCategory.desserts,
        price=Decimal("80.00"),
        is_available=True,
        quantity=20,
    )
    db.add_all([paneer, jamun])

    # 4. Add Dishes for Seller 2
    biryani = Menu(
        seller_id=user2.id,
        name="Hyderabadi Chicken Dum Biryani",
        description="Fragrant basmati rice cooked with marinated chicken",
        category=MenuCategory.non_veg,
        price=Decimal("260.00"),
        is_available=True,
        quantity=10,
        spice_level="spicy",
    )
    db.add(biryani)
    db.commit()

    # 5. Test Search by Keyword: 'biryani'
    search_res = client.get("/api/v1/menus/search?q=biryani")
    assert search_res.status_code == 200
    res_data = search_res.json()
    assert res_data["total"] == 1
    assert res_data["items"][0]["name"] == "Hyderabadi Chicken Dum Biryani"
    assert res_data["items"][0]["seller_name"] == "Chef Tariq"
    assert res_data["items"][0]["seller_flat"] == "D-804"
    assert len(res_data["matched_sellers"]) == 1
    assert res_data["matched_sellers"][0]["name"] == "Chef Tariq"

    # 6. Test Veg Only Search
    veg_res = client.get("/api/v1/menus/search?veg_only=true")
    assert veg_res.status_code == 200
    veg_items = veg_res.json()["items"]
    assert all(it["category"] == "veg" for it in veg_items)
    assert any(it["name"] == "Paneer Butter Masala" for it in veg_items)
    assert not any(it["name"] == "Hyderabadi Chicken Dum Biryani" for it in veg_items)

    # 7. Test Category Filter: 'desserts'
    dessert_res = client.get("/api/v1/menus/search?category=desserts")
    assert dessert_res.status_code == 200
    assert dessert_res.json()["total"] == 1
    assert dessert_res.json()["items"][0]["name"] == "Gulab Jamun (4 pcs)"

    # 8. Test Search by Flat Number: 'C-202'
    flat_res = client.get("/api/v1/menus/search?q=C-202")
    assert flat_res.status_code == 200
    assert flat_res.json()["total"] >= 1
    assert any(it["seller_name"] == "Chef Kavita" for it in flat_res.json()["items"])

    # 9. Test Closed Kitchen Availability Guard
    prof2.is_open = False
    db.commit()
    closed_search = client.get("/api/v1/menus/search?q=biryani&available_only=true")
    assert closed_search.status_code == 200
    assert closed_search.json()["total"] == 0
