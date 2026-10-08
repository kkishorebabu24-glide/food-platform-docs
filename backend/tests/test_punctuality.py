"""Tests for automated punctuality and reliability rating service."""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db.models import Delivery, Order, PartnerProfile, User
from app.db.models.enums import OrderStatus, PartnerApplicationStatus, PartnerStatus, UserRole
from app.services.punctuality_service import (
    calculate_order_is_on_time,
    update_partner_punctuality_on_order_completed,
)


def test_calculate_order_is_on_time_instant(db: Session):
    now = datetime.now(timezone.utc)
    # Order placed 20 mins ago, completed now with estimated 30 mins -> On time
    order = Order(
        resident_id=1,
        partner_id=2,
        status=OrderStatus.delivered,
        items=[],
        total_price=100.0,
        created_at=now - timedelta(minutes=20),
        completed_at=now,
        is_preorder=False,
    )
    delivery = Delivery(
        order_id=1,
        partner_id=2,
        resident_id=1,
        estimated_minutes=30,
    )

    is_on_time, duration = calculate_order_is_on_time(order, delivery)
    assert is_on_time is True
    assert duration == 20


def test_calculate_order_is_on_time_preorder(db: Session):
    today = date.today()
    completed_time = datetime(today.year, today.month, today.day, 13, 15, tzinfo=timezone.utc)
    created_time = datetime(today.year, today.month, today.day, 9, 0, tzinfo=timezone.utc)

    order = Order(
        resident_id=1,
        partner_id=2,
        status=OrderStatus.delivered,
        items=[],
        total_price=200.0,
        created_at=created_time,
        completed_at=completed_time,
        is_preorder=True,
        delivery_slot="lunch_today",
        target_delivery_date=today,
    )

    is_on_time, duration = calculate_order_is_on_time(order, None)
    assert is_on_time is True


def test_update_partner_punctuality_flow(db: Session):
    partner_user = User(
        name="Punctual Chef",
        email="punctual@test.com",
        role=UserRole.partner,
        is_active=True,
    )
    db.add(partner_user)
    db.commit()
    partner_prof = PartnerProfile(
        id=partner_user.id,
        bio="Fast Chef",
        application_status=PartnerApplicationStatus.approved,
        partner_status=PartnerStatus.active,
        on_time_delivery_rate=100.0,
        punctuality_rating=5.0,
    )
    db.add(partner_prof)
    db.commit()

    now = datetime.now(timezone.utc)
    order1 = Order(
        resident_id=1,
        partner_id=partner_user.id,
        status=OrderStatus.delivered,
        items=[{"name": "Thali", "quantity": 1, "price": 120.0}],
        total_price=120.0,
        created_at=now - timedelta(minutes=25),
        completed_at=now,
        is_preorder=False,
    )
    db.add(order1)
    db.commit()

    updated_prof = update_partner_punctuality_on_order_completed(db, partner_user.id, order1)
    assert updated_prof is not None
    assert updated_prof.total_orders_completed == 1
    assert updated_prof.on_time_delivery_rate == 100.0
    assert updated_prof.punctuality_rating == 5.0
