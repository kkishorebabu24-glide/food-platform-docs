"""Reconcile migration-built schema with the ORM models

Revision ID: b8d21f0c4e57
Revises: c789123ef456
Create Date: 2026-10-08 18:00:00.000000

Several model features (community cravings, pre-orders, review moderation and
the expanded order/payment/delivery lifecycles) were shipped without matching
migrations, so a fresh ``alembic upgrade head`` produced a schema the
application could not query. This revision brings any database - whether built
from the chain or bootstrapped via ``create_all`` and stamped - to the exact
shape of ``app.db.models``.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b8d21f0c4e57"
down_revision: Union[str, Sequence[str], None] = "c789123ef456"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ORDER_STATUSES_OLD = ("pending", "accepted", "ready", "completed", "cancelled")
ORDER_STATUSES = (
    "draft",
    "placed",
    "accepted",
    "rejected",
    "preparing",
    "ready",
    "dispatched",
    "in_transit",
    "delivered",
    "cancelled",
    "refund_pending",
    "refunded",
    # Legacy labels kept so OrderStatus.pending/completed aliases stay valid
    "pending",
    "completed",
)
ORDER_UPGRADE_MAP = {s: s for s in ORDER_STATUSES} | {"pending": "placed", "completed": "delivered"}
ORDER_DOWNGRADE_MAP = {
    "draft": "pending",
    "placed": "pending",
    "accepted": "accepted",
    "rejected": "cancelled",
    "preparing": "accepted",
    "ready": "ready",
    "dispatched": "ready",
    "in_transit": "ready",
    "delivered": "completed",
    "cancelled": "cancelled",
    "refund_pending": "cancelled",
    "refunded": "cancelled",
    "pending": "pending",
    "completed": "completed",
}

PAYMENT_STATUSES_OLD = ("created", "captured", "failed", "refunded", "submitted")
PAYMENT_STATUSES = (
    "initiated",
    "pending",
    "authorized",
    "captured",
    "failed",
    "cancelled",
    "refund_pending",
    "refunded",
    "partially_refunded",
)
PAYMENT_UPGRADE_MAP = {"created": "initiated", "submitted": "pending"} | {
    s: s for s in PAYMENT_STATUSES
}
PAYMENT_DOWNGRADE_MAP = {
    "initiated": "created",
    "pending": "submitted",
    "authorized": "created",
    "captured": "captured",
    "failed": "failed",
    "cancelled": "failed",
    "refund_pending": "captured",
    "refunded": "refunded",
    "partially_refunded": "refunded",
}

DELIVERY_STATUSES_OLD = ("pending", "dispatched", "delivered", "failed")
DELIVERY_STATUSES = (
    "not_required",
    "pending",
    "dispatched",
    "in_transit",
    "delivered",
    "failed",
    "returned",
)
DELIVERY_DOWNGRADE_MAP = {
    "not_required": "delivered",
    "pending": "pending",
    "dispatched": "dispatched",
    "in_transit": "dispatched",
    "delivered": "delivered",
    "failed": "failed",
    "returned": "failed",
}

DELIVERY_TYPES = ("doorstep", "self_pickup")
REVIEW_STATUSES = ("pending", "published", "hidden", "removed", "flagged")
SUGGESTION_STATUSES = ("open", "claimed_by_chef", "fulfilled", "closed")


PARTNER_METRICS: list[tuple[str, sa.types.TypeEngine, str]] = [
    ("on_time_delivery_rate", sa.Float(), "100.0"),
    ("punctuality_rating", sa.Float(), "5.0"),
    ("avg_delivery_minutes", sa.Integer(), "25"),
    ("total_orders_completed", sa.Integer(), "0"),
]


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _enum_values(type_name: str) -> list[str]:
    rows = op.get_bind().execute(
        sa.text(
            "SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid "
            "WHERE t.typname = :n ORDER BY e.enumsortorder"
        ),
        {"n": type_name},
    )
    return [r[0] for r in rows]


def _quote_values(values: Sequence[str]) -> str:
    return ", ".join("'" + v.replace("'", "''") + "'" for v in values)


def _ensure_enum(type_name: str, values: Sequence[str]) -> None:
    if not _enum_values(type_name):
        op.execute(f"CREATE TYPE {type_name} AS ENUM ({_quote_values(values)})")


def _drop_enum(type_name: str) -> None:
    if _enum_values(type_name):
        op.execute(f"DROP TYPE {type_name}")


def _rebuild_enum(
    type_name: str,
    table: str,
    column: str,
    values: Sequence[str],
    mapping: dict[str, str],
    fallback: str,
) -> None:
    if list(_enum_values(type_name)) == list(values):
        return
    tmp = f"{type_name}_new"
    op.execute(f"CREATE TYPE {tmp} AS ENUM ({_quote_values(values)})")
    cases = " ".join(f"WHEN '{old}' THEN '{new}'" for old, new in mapping.items())
    op.execute(
        f"ALTER TABLE {table} ALTER COLUMN {column} TYPE {tmp} USING "
        f"(CASE {column}::text {cases} ELSE '{fallback}' END)::{tmp}"
    )
    op.execute(f"DROP TYPE {type_name}")
    op.execute(f"ALTER TYPE {tmp} RENAME TO {type_name}")


def _add_column(table: str, column: sa.Column) -> None:
    if column.name not in _columns(table):
        op.add_column(table, column)


def _drop_column(table: str, name: str) -> None:
    if table in _tables() and name in _columns(table):
        op.drop_column(table, name)


def _enum(name: str, values: Sequence[str]) -> postgresql.ENUM:
    return postgresql.ENUM(*values, name=name, create_type=False)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    ]


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        raise RuntimeError("This migration targets PostgreSQL only")

    # Expanded lifecycles
    _rebuild_enum(
        "orderstatus",
        "orders",
        "status",
        ORDER_STATUSES,
        ORDER_UPGRADE_MAP,
        fallback="placed",
    )
    _rebuild_enum(
        "paymentstatus",
        "payments",
        "status",
        PAYMENT_STATUSES,
        PAYMENT_UPGRADE_MAP,
        fallback="initiated",
    )
    _rebuild_enum(
        "deliverystatus",
        "deliveries",
        "status",
        DELIVERY_STATUSES,
        {s: s for s in DELIVERY_STATUSES},
        fallback="pending",
    )

    # Pre-orders
    _ensure_enum("deliverytype", DELIVERY_TYPES)
    _add_column("menus", sa.Column("preorder_cutoff_time", sa.String(length=10), nullable=True))
    _add_column("menus", sa.Column("available_slots", sa.JSON(), nullable=True))
    _add_column(
        "orders",
        sa.Column("is_preorder", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    _add_column("orders", sa.Column("delivery_slot", sa.String(length=50), nullable=True))
    _add_column("orders", sa.Column("target_delivery_date", sa.Date(), nullable=True))
    _add_column(
        "orders",
        sa.Column(
            "delivery_type",
            _enum("deliverytype", DELIVERY_TYPES),
            nullable=False,
            server_default="doorstep",
        ),
    )

    # Partner performance metrics
    for name, col_type, default in PARTNER_METRICS:
        _add_column(
            "partner_profiles",
            sa.Column(name, col_type, nullable=False, server_default=sa.text(default)),
        )

    # Review moderation: reviews that existed before moderation stay visible
    _ensure_enum("reviewstatus", REVIEW_STATUSES)
    if "review_status" not in _columns("ratings"):
        op.add_column(
            "ratings",
            sa.Column(
                "review_status",
                _enum("reviewstatus", REVIEW_STATUSES),
                nullable=False,
                server_default="published",
            ),
        )
        op.alter_column("ratings", "review_status", server_default=None)

    # Community cravings marketplace
    _ensure_enum("suggestionstatus", SUGGESTION_STATUSES)
    if "dish_suggestions" not in _tables():
        op.create_table(
            "dish_suggestions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column(
                "category",
                _enum(
                    "menucategory",
                    ("veg", "non_veg", "snacks", "desserts", "beverages", "other"),
                ),
                nullable=False,
            ),
            sa.Column("target_date", sa.Date(), nullable=True),
            sa.Column("upvotes_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column(
                "status",
                _enum("suggestionstatus", SUGGESTION_STATUSES),
                nullable=False,
                server_default="open",
            ),
            sa.Column(
                "accepted_by_partner_id",
                sa.Integer(),
                sa.ForeignKey("partner_profiles.id"),
                nullable=True,
            ),
            sa.Column(
                "created_menu_id",
                sa.Integer(),
                sa.ForeignKey("menus.id"),
                nullable=True,
            ),
            *_timestamps(),
        )
        op.create_index("ix_dish_suggestions_id", "dish_suggestions", ["id"])
        op.create_index("ix_dish_suggestions_user_id", "dish_suggestions", ["user_id"])
        op.create_index(
            "ix_dish_suggestions_accepted_by_partner_id",
            "dish_suggestions",
            ["accepted_by_partner_id"],
        )
    if "dish_upvotes" not in _tables():
        op.create_table(
            "dish_upvotes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column(
                "suggestion_id",
                sa.Integer(),
                sa.ForeignKey("dish_suggestions.id"),
                nullable=False,
            ),
            *_timestamps(),
            sa.UniqueConstraint("user_id", "suggestion_id", name="uq_user_dish_suggestion"),
        )
        op.create_index("ix_dish_upvotes_id", "dish_upvotes", ["id"])
        op.create_index("ix_dish_upvotes_user_id", "dish_upvotes", ["user_id"])
        op.create_index("ix_dish_upvotes_suggestion_id", "dish_upvotes", ["suggestion_id"])


def downgrade() -> None:
    if "dish_upvotes" in _tables():
        op.drop_table("dish_upvotes")
    if "dish_suggestions" in _tables():
        op.drop_table("dish_suggestions")
    _drop_enum("suggestionstatus")

    _drop_column("ratings", "review_status")
    _drop_enum("reviewstatus")

    for name, _, _ in reversed(PARTNER_METRICS):
        _drop_column("partner_profiles", name)

    _drop_column("orders", "delivery_type")
    _drop_column("orders", "target_delivery_date")
    _drop_column("orders", "delivery_slot")
    _drop_column("orders", "is_preorder")
    _drop_column("menus", "available_slots")
    _drop_column("menus", "preorder_cutoff_time")
    _drop_enum("deliverytype")

    _rebuild_enum(
        "deliverystatus",
        "deliveries",
        "status",
        DELIVERY_STATUSES_OLD,
        DELIVERY_DOWNGRADE_MAP,
        fallback="pending",
    )
    _rebuild_enum(
        "paymentstatus",
        "payments",
        "status",
        PAYMENT_STATUSES_OLD,
        PAYMENT_DOWNGRADE_MAP,
        fallback="created",
    )
    _rebuild_enum(
        "orderstatus",
        "orders",
        "status",
        ORDER_STATUSES_OLD,
        ORDER_DOWNGRADE_MAP,
        fallback="pending",
    )
