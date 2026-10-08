"""
Central enum definitions for the Society Food Platform.

Using Python str+enum ensures:
  - String values stored in PostgreSQL native enum type
  - JSON serialisation works naturally (values are plain strings)
  - Comparison with raw string literals works (str subclass)

Roles (from RBAC spec):
  resident   -- Default role for every society member (formerly 'resident')
  partner    -- Community food partner / home chef (formerly 'partner')
  admin      -- Society food admin
  super_admin -- Platform super-admin
"""

import enum


class UserRole(str, enum.Enum):
    """Platform participant roles."""

    resident = "resident"  # Default; every society member is a resident first
    partner = "partner"  # Community home chef / food partner (formerly 'partner')
    admin = "admin"
    super_admin = "super_admin"

    # Backward compatibility aliases
    buyer = "resident"
    seller = "partner"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            mapping = {"seller": cls.partner, "buyer": cls.resident}
            if value.lower() in mapping:
                return mapping[value.lower()]
        return None


class UserStatus(str, enum.Enum):
    """5-state lifecycle for a user account."""

    pending_verification = "pending_verification"  # Registered; email not yet verified
    active = "active"  # Verified and in good standing
    suspended = "suspended"  # Temporarily restricted by admin
    blocked = "blocked"  # Permanently blocked
    deactivated = "deactivated"  # User-requested deactivation


class PartnerApplicationStatus(str, enum.Enum):
    """6-state admin review lifecycle for a partner application."""

    draft = "draft"  # Application started but not submitted
    pending = "pending"  # Submitted; awaiting admin review
    under_review = "under_review"  # Admin is actively reviewing
    approved = "approved"  # Application approved; partner is active
    rejected = "rejected"  # Application rejected by admin
    withdrawn = "withdrawn"  # Applicant withdrew their application


class PartnerStatus(str, enum.Enum):
    """Operational status of an approved partner."""

    pending = "pending"  # Not yet approved (default before approval)
    active = "active"  # Approved and operating
    suspended = "suspended"  # Temporarily suspended by admin
    blocked = "blocked"  # Permanently blocked
    inactive = "inactive"  # Partner self-deactivated


# Backward compatibility aliases
ApprovalStatus = PartnerApplicationStatus
SellerStatus = PartnerStatus


class OrderStatus(str, enum.Enum):
    """12-state lifecycle for a resident order."""

    draft = "draft"  # Order being built by resident (not submitted)
    placed = "placed"  # Order submitted; awaiting partner acceptance
    accepted = "accepted"  # Partner accepted the order
    rejected = "rejected"  # Partner rejected the order
    preparing = "preparing"  # Partner is cooking
    ready = "ready"  # Food is ready for pickup / dispatch
    dispatched = "dispatched"  # Partner has picked up food for doorstep delivery
    in_transit = "in_transit"  # En route to resident's flat
    delivered = "delivered"  # Successfully delivered to resident
    cancelled = "cancelled"  # Order cancelled (by resident or partner)
    refund_pending = "refund_pending"  # Cancellation accepted; refund being processed
    refunded = "refunded"  # Refund completed


class PaymentStatus(str, enum.Enum):
    """9-state payment lifecycle (Direct UPI & Gateway)."""

    initiated = "initiated"  # Payment intent created
    pending = "pending"  # Resident submitted UTR; awaiting partner confirmation
    authorized = "authorized"  # Authorised by gateway (pre-capture)
    captured = "captured"  # Payment confirmed / captured
    failed = "failed"  # Payment failed or rejected
    cancelled = "cancelled"  # Payment cancelled before capture
    refund_pending = "refund_pending"  # Refund initiated; being processed
    refunded = "refunded"  # Full refund completed
    partially_refunded = "partially_refunded"  # Partial refund completed


class DeliveryStatus(str, enum.Enum):
    """7-state in-building delivery lifecycle."""

    not_required = "not_required"  # Self-pickup; no delivery needed
    pending = "pending"  # Delivery record created; partner hasn't left yet
    dispatched = "dispatched"  # Partner picked up and is walking to resident's flat
    in_transit = "in_transit"  # En route (multi-stop / longer corridors)
    delivered = "delivered"  # Food handed to resident at their door
    failed = "failed"  # Could not complete delivery (resident absent, etc.)
    returned = "returned"  # Food returned to partner's flat


class ReviewStatus(str, enum.Enum):
    """5-state moderation lifecycle for a rating / review."""

    pending = "pending"  # Submitted; awaiting auto / manual moderation
    published = "published"  # Visible to all users
    hidden = "hidden"  # Hidden by admin (not deleted)
    removed = "removed"  # Permanently removed
    flagged = "flagged"  # Flagged by users for review


class MenuCategory(str, enum.Enum):
    """Food item category for a partner's menu item."""

    veg = "veg"
    non_veg = "non-veg"  # stored value is "non-veg" for backward compat
    snacks = "snacks"
    desserts = "desserts"
    beverages = "beverages"
    other = "other"


class LedgerEntryType(str, enum.Enum):
    """Type of accounting entry in the partner ledger."""

    credit = "credit"  # Sale revenue credited to partner
    debit = "debit"  # Deduction (e.g., reversal)
    platform_fee = "platform_fee"  # Platform commission deducted
    maintenance_fee = "maintenance_fee"  # Flat SaaS maintenance fee per order
    maintenance_recharge = "maintenance_recharge"  # Platform maintenance credit top-up
    refund = "refund"  # Refund deducted from partner balance


class PayoutStatus(str, enum.Enum):
    """Payout transfer states."""

    pending = "pending"
    processing = "processing"
    paid = "paid"
    failed = "failed"


class DeliverySlot(str, enum.Enum):
    """Scheduled delivery / pickup slots for pre-orders."""

    lunch_today = "lunch_today"  # 12:30 PM - 1:30 PM Today
    dinner_today = "dinner_today"  # 7:30 PM - 8:30 PM Today
    lunch_tomorrow = "lunch_tomorrow"  # 12:30 PM - 1:30 PM Tomorrow
    dinner_tomorrow = "dinner_tomorrow"  # 7:30 PM - 8:30 PM Tomorrow
    weekend_special = "weekend_special"  # Saturday / Sunday Special Batch
    custom = "custom"


class DeliveryType(str, enum.Enum):
    """Fulfillment method chosen by the resident."""

    doorstep = "doorstep"  # In-building delivery to resident's flat
    self_pickup = "self_pickup"  # Resident picks up from partner's flat


class SuggestionStatus(str, enum.Enum):
    """Lifecycle status for community dish suggestions."""

    open = "open"  # Active for community upvotes
    claimed_by_chef = "claimed_by_chef"  # Partner agreed to cook; pre-order opened
    fulfilled = "fulfilled"  # Batch completed
    closed = "closed"  # Expired or closed


class NotificationStatus(str, enum.Enum):
    """Delivery status for a push / in-app notification."""

    pending = "pending"
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"
