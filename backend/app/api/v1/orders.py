"""
Order routes — resident placement and partner fulfillment.

  POST /api/v1/orders/                    → place a new order (resident)
  GET  /api/v1/orders/{id}                → get order details (resident/partner)
  PUT  /api/v1/orders/{id}/status         → update order status (partner/resident cancellation)

Email notifications and WebSocket pushes are sent as BackgroundTasks
so they never delay the HTTP response.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, require_role
from app.db.models import Order, PartnerProfile, User
from app.schemas.order import OrderCreateRequest, OrderResponse, OrderStatusUpdate
from app.services import notification_service, order_service
from app.services.websocket_manager import get_manager
from app.db.models.enums import OrderStatus, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)
RESIDENT_OR_ADMIN_DEPENDENCY = Depends(require_role("resident", "admin"))


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    request: OrderCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = RESIDENT_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Place a new order (residents only).

    After placing, sends an email notification to the partner in the background.
    """
    order = order_service.create_order(db, resident_id=current_user.id, request=request)

    # ── Notify partner via email (fire-and-forget) ─────────────────────────
    partner_user = db.query(User).filter(User.id == order.partner_id).first()
    if partner_user:
        items_summary = ", ".join(
            f"{item['quantity']}× {item['name']}" for item in (order.items or [])
        )
        background_tasks.add_task(
            notification_service.send_order_placed_email,
            partner_email=partner_user.email,
            partner_name=partner_user.name,
            order_id=order.id,
            resident_name=current_user.name,
            items_summary=items_summary,
            total_price=float(order.total_price),
        )

    return OrderResponse.model_validate(order)


@router.get("/", status_code=status.HTTP_200_OK)
async def list_orders(
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    List orders for current user:
    - If partner: returns orders placed to this partner's kitchen
    - If resident/admin: returns orders placed by this resident
    """
    if current_user.role == UserRole.partner:
        return order_service.get_partner_orders(
            db, partner_id=current_user.id, skip=skip, limit=limit, status_filter=status
        )
    return order_service.get_resident_orders(
        db, resident_id=current_user.id, skip=skip, limit=limit, status_filter=status
    )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Get details of a specific order (BOLA protected)."""
    order = order_service.get_order_by_id(db, order_id)
    if current_user.role != "admin" and order.resident_id != current_user.id and order.partner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this order.",
        )
    return OrderResponse.model_validate(order)


@router.delete("/{order_id}", response_model=OrderResponse)
async def cancel_order(
    order_id: int,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Cancel a pending order (resident only)."""
    order = order_service.cancel_order(db, order_id=order_id, resident_id=current_user.id)
    return OrderResponse.model_validate(order)



@router.put("/{order_id}/status", response_model=OrderResponse)
async def update_status(
    order_id: int,
    request: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Update the status of an order.

    - Partners can accept, mark ready, or cancel.
    - Residents can cancel (only while pending).
    - Admins can force any state.

    After update: pushes real-time WS event + sends email to resident (background).
    """
    order = order_service.update_order_status(
        db,
        order_id=order_id,
        new_status=request.status,
        actor_id=current_user.id,
        actor_role=current_user.role,
    )

    # ── WebSocket push — real-time update to all listeners ────────────────
    manager = get_manager()
    background_tasks.add_task(
        manager.broadcast_order_update,
        order_id=order_id,
        data={
            "event": "order_status_changed",
            "order_id": order_id,
            "status": request.status,
        },
    )

    # ── Email resident about the status change ───────────────────────────────
    resident_user = db.query(User).filter(User.id == order.resident_id).first()
    partner_user = db.query(User).filter(User.id == order.partner_id).first()
    if resident_user and partner_user:
        partner_profile = db.query(PartnerProfile).filter(
            PartnerProfile.id == order.partner_id
        ).first()
        background_tasks.add_task(
            notification_service.send_order_status_email,
            resident_email=resident_user.email,
            resident_name=resident_user.name,
            order_id=order_id,
            new_status=request.status,
            partner_name=partner_user.name,
            partner_flat=partner_user.flat_number,
        )

    return OrderResponse.model_validate(order)
