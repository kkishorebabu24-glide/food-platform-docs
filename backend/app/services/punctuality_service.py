"""Punctuality and Reliability Service.

Calculates objective delivery punctuality metrics based on order and delivery timestamps:
- Compares actual completed_at timestamp against scheduled delivery slot deadlines or estimated prep+delivery times.
- Updates rolling on_time_delivery_rate, avg_delivery_minutes, and punctuality_rating on the PartnerProfile.
"""

import logging
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.delivery import Delivery
from app.db.models.enums import OrderStatus
from app.db.models.order import Order
from app.db.models.partner_profile import PartnerProfile

logger = logging.getLogger(__name__)

# Standard cutoff deadlines for standard delivery slots
SLOT_DEADLINES = {
    "lunch_today": time(14, 0),  # Lunch window deadline 2:00 PM
    "lunch_tomorrow": time(14, 0),
    "dinner_today": time(21, 0),  # Dinner window deadline 9:00 PM
    "dinner_tomorrow": time(21, 0),
    "weekend_special": time(15, 0),
}


def calculate_order_is_on_time(order: Order, delivery: Delivery | None = None) -> tuple[bool, int]:
    """
    Determines if an order was delivered on time and calculates total delivery minutes.

    Returns:
        (is_on_time: bool, duration_minutes: int)
    """
    completed_time = order.completed_at or datetime.now(timezone.utc)
    created_time = order.created_at or completed_time

    # Calculate duration
    duration_minutes = max(1, int((completed_time - created_time).total_seconds() / 60))

    # 1. Pre-Order Batch Evaluation
    if order.is_preorder and order.delivery_slot:
        slot_key = order.delivery_slot.lower().strip()
        deadline_time = SLOT_DEADLINES.get(slot_key)

        if deadline_time and order.target_delivery_date:
            # Construct target deadline datetime
            target_dt = datetime.combine(
                order.target_delivery_date,
                deadline_time,
                tzinfo=timezone.utc if completed_time.tzinfo else None,
            )
            # 10-minute grace period
            is_on_time = completed_time <= (target_dt + timedelta(minutes=10))
            return is_on_time, duration_minutes

        # If no explicit target date or deadline, check if completed within lead time
        return True, duration_minutes

    # 2. Instant Order Evaluation
    estimated_minutes = 35  # Default estimate
    if delivery and delivery.estimated_minutes:
        estimated_minutes = delivery.estimated_minutes

    # On time if delivered within estimated time + 10 min grace period
    is_on_time = duration_minutes <= (estimated_minutes + 10)
    return is_on_time, duration_minutes


def update_partner_punctuality_on_order_completed(
    db: Session, partner_id: int, completed_order: Order
) -> PartnerProfile | None:
    """
    Recalculates and updates the partner's punctuality stats upon order completion.
    """
    partner_profile = db.scalar(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    if not partner_profile:
        return None

    # Fetch all completed orders for this partner
    completed_orders = db.scalars(
        select(Order).where(Order.partner_id == partner_id, Order.status == OrderStatus.delivered)
    ).all()

    if not completed_orders:
        return partner_profile

    # Fetch associated deliveries
    order_ids = [o.id for o in completed_orders]
    deliveries = (
        db.scalars(select(Delivery).where(Delivery.order_id.in_(order_ids))).all()
        if order_ids
        else []
    )
    delivery_map = {d.order_id: d for d in deliveries}

    on_time_count = 0
    total_duration = 0
    total_count = len(completed_orders)

    for ord_item in completed_orders:
        deliv = delivery_map.get(ord_item.id)
        is_on_time, duration = calculate_order_is_on_time(ord_item, deliv)
        if is_on_time:
            on_time_count += 1
        total_duration += duration

    on_time_rate = round((on_time_count / total_count) * 100, 1)
    avg_minutes = max(5, int(total_duration / total_count))

    # Scale punctuality rating to 1.0 - 5.0
    # 100% on time -> 5.0, 50% on time -> 3.0, 0% on time -> 1.0
    punctuality_rating = round(1.0 + (on_time_rate / 100.0) * 4.0, 1)

    partner_profile.on_time_delivery_rate = on_time_rate
    partner_profile.punctuality_rating = punctuality_rating
    partner_profile.avg_delivery_minutes = avg_minutes
    partner_profile.total_orders_completed = total_count

    db.flush()
    logger.info(
        "Updated punctuality for partner %d: on_time=%.1f%%, punctuality=%.1f, avg_mins=%d, total_completed=%d",
        partner_id,
        on_time_rate,
        punctuality_rating,
        avg_minutes,
        total_count,
    )
    return partner_profile
