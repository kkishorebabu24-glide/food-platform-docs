"""
Ledger service — manages partner virtual balance via accounting entries.

After each captured payment:
  1. Credit partner with (total_price - platform_fee)
  2. Record platform_fee as a separate negative entry

Balance = sum of all positive credit entries - sum of negative entries.
"""

import logging
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import LedgerEntry, Payment
from app.db.models.enums import LedgerEntryType, PaymentStatus

logger = logging.getLogger(__name__)

_PLATFORM_FEE_RATE: Decimal | None = None


def _get_platform_fee_rate() -> Decimal:
    global _PLATFORM_FEE_RATE
    if _PLATFORM_FEE_RATE is None:
        _PLATFORM_FEE_RATE = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / 100
    return _PLATFORM_FEE_RATE


def get_partner_balance(db: Session, partner_id: int) -> Decimal:
    """Return the current outstanding balance for a partner."""
    result = (
        db.query(func.sum(LedgerEntry.amount)).filter(LedgerEntry.user_id == partner_id).scalar()
    )
    return Decimal(str(result or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_partner_ledger(db: Session, partner_id: int, skip: int = 0, limit: int = 20) -> dict:
    """Return paginated ledger entries for a partner."""
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.user_id == partner_id)
        .order_by(LedgerEntry.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(LedgerEntry).filter(LedgerEntry.user_id == partner_id).count()

    return {
        "entries": [
            {
                "id": e.id,
                "order_id": e.order_id,
                "entry_type": e.entry_type,
                "amount": float(e.amount),
                "balance_after": float(e.balance_after),
                "description": e.description,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
        "total": total,
        "current_balance": float(get_partner_balance(db, partner_id)),
    }


def record_payment_credit(db: Session, payment: Payment) -> None:
    """
    Create ledger entries after a successful payment capture.

    Two entries are created:
      1. credit:        partner_amount = total_price - platform_fee  (positive)
      2. platform_fee:  negative amount recording the commission    (negative)
    """
    if payment.status != PaymentStatus.captured:
        logger.warning("record_payment_credit called for non-captured payment %s", payment.id)
        return

    fee_rate = _get_platform_fee_rate()
    platform_fee = (Decimal(str(payment.amount)) * fee_rate).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    partner_credit = Decimal(str(payment.amount)) - platform_fee

    partner_id = payment.partner_id
    current_balance = get_partner_balance(db, partner_id)

    # ── Entry 1: Credit partner ─────────────────────────────────────────────
    balance_after_credit = current_balance + partner_credit
    credit_entry = LedgerEntry(
        payment_id=payment.id,
        user_id=partner_id,
        order_id=payment.order_id,
        entry_type=LedgerEntryType.credit,
        amount=partner_credit,
        balance_after=balance_after_credit,
        description=(
            f"Sale credit for order #{payment.order_id} "
            f"(total \u20b9{float(payment.amount):.2f} - fee \u20b9{float(platform_fee):.2f})"
        ),
    )
    db.add(credit_entry)

    # ── Entry 2: Platform fee ──────────────────────────────────────────────
    # The fee entry uses balance_after_credit because the credit entry
    # already nets out the fee — this entry is for transparency only.
    fee_entry = LedgerEntry(
        payment_id=payment.id,
        user_id=partner_id,
        order_id=payment.order_id,
        entry_type=LedgerEntryType.platform_fee,
        amount=-platform_fee,
        balance_after=balance_after_credit,  # net balance unchanged by this entry
        description=(
            f"Platform fee ({settings.PLATFORM_FEE_PERCENT}%) " f"for order #{payment.order_id}"
        ),
    )
    db.add(fee_entry)

    logger.info(
        "Ledger entries created: partner_id=%s credit=%.2f fee=%.2f",
        partner_id,
        float(partner_credit),
        float(platform_fee),
    )


def record_refund(db: Session, payment: Payment) -> None:
    """Deduct a refunded amount from the partner's ledger."""
    partner_id = payment.partner_id
    current_balance = get_partner_balance(db, partner_id)
    refund_amount = Decimal(str(payment.amount))
    balance_after = current_balance - refund_amount

    refund_entry = LedgerEntry(
        payment_id=payment.id,
        user_id=partner_id,
        order_id=payment.order_id,
        entry_type=LedgerEntryType.refund,
        amount=-refund_amount,
        balance_after=balance_after,
        description=f"Refund for order #{payment.order_id}",
    )
    db.add(refund_entry)
    logger.info(
        "Refund ledger entry created: partner_id=%s amount=%.2f",
        partner_id,
        float(refund_amount),
    )
