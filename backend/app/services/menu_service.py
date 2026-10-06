"""Menu service — CRUD for a partner's menu items."""

import logging
import os
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import Menu, PartnerProfile, User
from app.db.models.enums import PartnerApplicationStatus
from app.schemas.menu import MenuCreateRequest, MenuUpdateRequest

logger = logging.getLogger(__name__)

# ── Image Upload Config ───────────────────────────────────────────────────────
UPLOAD_DIR = Path("uploads/menus")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE_MB = 5


def get_partner_menus(
    db: Session,
    partner_id: int,
    available_only: bool = True,
    category: str | None = None,
    search: str | None = None,
) -> dict:
    """
    Return menu items for a partner.

    Supports filtering by:
      - available_only: only items with is_available=True (default)
      - category:       filter by MenuCategory value (e.g. 'veg', 'non-veg')
      - search:         case-insensitive substring match on item name
    """
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner {partner_id} not found.",
        )

    query = db.query(Menu).filter(Menu.partner_id == partner_id)

    if available_only:
        query = query.filter(Menu.is_available == True)

    if category:
        query = query.filter(Menu.category == category)

    if search:
        query = query.filter(Menu.name.ilike(f"%{search}%"))

    items = query.all()
    return {
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "category": item.category,
                "price": float(item.price),
                "is_available": item.is_available,
                "quantity": item.quantity,
                "image_url": item.image_url,
                "is_preorder_only": item.is_preorder_only,
                "preorder_cutoff_time": item.preorder_cutoff_time,
                "available_slots": item.available_slots or [],
                "max_batch_quantity": item.max_batch_quantity,
                "min_lead_time_hours": item.min_lead_time_hours,
                "spice_level": item.spice_level or "medium",
            }
            for item in items
        ],
        "total": len(items),
    }


def search_public_dishes(
    db: Session,
    query: str | None = None,
    category: str | None = None,
    veg_only: bool = False,
    available_only: bool = True,
    skip: int = 0,
    limit: int = 50,
) -> dict:
    """
    Search dishes across all approved active partners in the society.
    Returns matched dish items joined with partner & user metadata, plus matched partners summary.
    """
    q = (
        db.query(Menu, PartnerProfile, User)
        .join(PartnerProfile, Menu.partner_id == PartnerProfile.id)
        .join(User, PartnerProfile.id == User.id)
        .filter(
            PartnerProfile.application_status == PartnerApplicationStatus.approved,
            User.is_active == True,
        )
    )

    if available_only:
        q = q.filter(Menu.is_available == True, PartnerProfile.is_open == True)

    if veg_only:
        q = q.filter(Menu.category == "veg")
    elif category and category != "all":
        if category in ("non_veg", "non-veg"):
            q = q.filter(Menu.category.in_(["non-veg", "non_veg"]))
        else:
            q = q.filter(Menu.category == category)

    if query and query.strip():
        term = f"%{query.strip()}%"
        q = q.filter(
            or_(
                Menu.name.ilike(term),
                Menu.description.ilike(term),
                User.name.ilike(term),
                User.flat_number.ilike(term),
            )
        )

    results = q.offset(skip).limit(limit).all()

    items = []
    matched_partners_map = {}

    for menu_item, partner, user in results:
        dish_info = {
            "id": menu_item.id,
            "name": menu_item.name,
            "description": menu_item.description,
            "category": menu_item.category,
            "price": float(menu_item.price),
            "is_available": menu_item.is_available,
            "quantity": menu_item.quantity,
            "image_url": menu_item.image_url,
            "is_preorder_only": menu_item.is_preorder_only,
            "preorder_cutoff_time": menu_item.preorder_cutoff_time,
            "available_slots": menu_item.available_slots or [],
            "spice_level": menu_item.spice_level or "medium",
            "partner_id": partner.id,
            "partner_name": user.name,
            "partner_flat": user.flat_number,
            "partner_photo_url": partner.photo_url,
            "partner_banner_url": getattr(partner, "banner_url", None),
            "partner_photos": getattr(partner, "photos", []) or [],
            "partner_rating": partner.rating,
            "partner_punctuality": getattr(partner, "on_time_delivery_rate", 100.0),
            # Backward compatibility aliases for existing frontend
            "seller_id": partner.id,
            "seller_name": user.name,
            "seller_flat": user.flat_number,
            "seller_photo_url": partner.photo_url,
            "seller_banner_url": getattr(partner, "banner_url", None),
            "seller_photos": getattr(partner, "photos", []) or [],
            "seller_rating": partner.rating,
            "seller_punctuality": getattr(partner, "on_time_delivery_rate", 100.0),
        }
        items.append(dish_info)

        if partner.id not in matched_partners_map:
            matched_partners_map[partner.id] = {
                "id": partner.id,
                "name": user.name,
                "flat_number": user.flat_number,
                "photo_url": partner.photo_url,
                "banner_url": getattr(partner, "banner_url", None),
                "photos": getattr(partner, "photos", []) or [],
                "rating": partner.rating,
                "matching_dishes_count": 0,
                "sample_dishes": [],
            }
        matched_partners_map[partner.id]["matching_dishes_count"] += 1
        if len(matched_partners_map[partner.id]["sample_dishes"]) < 4:
            matched_partners_map[partner.id]["sample_dishes"].append({
                "id": menu_item.id,
                "name": menu_item.name,
                "price": float(menu_item.price),
                "image_url": menu_item.image_url,
            })

    matched_partners_list = list(matched_partners_map.values())
    return {
        "items": items,
        "total": len(items),
        "matched_partners": matched_partners_list,
        # Backward compatibility alias
        "matched_sellers": matched_partners_list,
    }


def create_menu_item(
    db: Session,
    partner_id: int,
    request: MenuCreateRequest,
) -> Menu:
    """Create a new menu item for the given partner."""
    partner = db.query(PartnerProfile).filter(PartnerProfile.id == partner_id).first()
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner {partner_id} not found.",
        )

    item = Menu(
        partner_id=partner_id,
        name=request.name,
        description=request.description,
        category=request.category,
        price=request.price,
        is_available=request.is_available,
        quantity=request.quantity if request.quantity is not None else 0,
        is_preorder_only=request.is_preorder_only,
        preorder_cutoff_time=request.preorder_cutoff_time,
        available_slots=request.available_slots,
        max_batch_quantity=request.max_batch_quantity,
        min_lead_time_hours=request.min_lead_time_hours,
        image_url=request.image_url,
        spice_level=request.spice_level or "medium",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_menu_item(
    db: Session,
    menu_id: int,
    request: MenuUpdateRequest,
    owner_id: int | None = None,
) -> Menu:
    """
    Update a menu item's fields.
    If owner_id is provided, ensures the item belongs to that partner.
    """
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    if owner_id and item.partner_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your menu item."
        )

    if request.name is not None:
        item.name = request.name
    if request.description is not None:
        item.description = request.description
    if request.price is not None:
        item.price = request.price
    if request.category is not None:
        item.category = request.category
    if request.is_available is not None:
        item.is_available = request.is_available
    if request.quantity is not None:
        item.quantity = max(0, request.quantity)
        if request.quantity == 0 and request.is_available is None:
            item.is_available = False
        elif request.quantity > 0 and request.is_available is None and not item.is_available:
            item.is_available = True
    if request.is_preorder_only is not None:
        item.is_preorder_only = request.is_preorder_only
    if request.preorder_cutoff_time is not None:
        item.preorder_cutoff_time = request.preorder_cutoff_time
    if request.available_slots is not None:
        item.available_slots = request.available_slots
    if request.max_batch_quantity is not None:
        item.max_batch_quantity = request.max_batch_quantity
    if request.min_lead_time_hours is not None:
        item.min_lead_time_hours = request.min_lead_time_hours
    if request.image_url is not None:
        item.image_url = request.image_url
    if request.spice_level is not None:
        item.spice_level = request.spice_level

    item.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item



def delete_menu_item(db: Session, menu_id: int, owner_id: int | None = None) -> None:
    """Delete a menu item. Optionally validates ownership."""
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    if owner_id and item.partner_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your menu item."
        )

    db.delete(item)
    db.commit()


def toggle_availability(
    db: Session,
    menu_id: int,
    is_available: bool,
    quantity: int | None = None,
    owner_id: int | None = None,
) -> Menu:
    """Toggle the is_available flag and portions on a menu item."""
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    if owner_id and item.partner_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your menu item."
        )

    if quantity is not None:
        item.quantity = max(0, quantity)
        item.is_available = is_available if (quantity > 0 or is_available) else False
    else:
        item.is_available = is_available
        if is_available and item.quantity == 0:
            item.quantity = 10  # replenish default stock if toggled on with 0 portions

    item.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item



async def upload_menu_image(
    db: Session,
    menu_id: int,
    file: UploadFile,
    owner_id: int | None = None,
) -> Menu:
    """
    Upload an image for a menu item and store it on the local filesystem.

    Saves to: uploads/menus/{menu_id}.{ext}
    Updates: Menu.image_url with the relative path (served as static file)
    """
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    if owner_id and item.partner_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your menu item."
        )

    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type: {file.content_type}. "
                   f"Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    # Read and validate file size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image too large ({size_mb:.1f} MB). Maximum allowed: {MAX_IMAGE_SIZE_MB} MB.",
        )

    # Determine extension from content type
    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    ext = ext_map.get(file.content_type, "jpg")

    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Remove old image if it exists
    if item.image_url:
        old_path = Path(item.image_url.lstrip("/"))
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    # Save new image
    filename = f"{menu_id}.{ext}"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(content)

    # Update DB record — store as URL-friendly path
    item.image_url = f"/uploads/menus/{filename}"
    item.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)

    logger.info("Menu image uploaded: menu_id=%s path=%s size=%.1fKB",
                menu_id, file_path, len(content) / 1024)
    return item
