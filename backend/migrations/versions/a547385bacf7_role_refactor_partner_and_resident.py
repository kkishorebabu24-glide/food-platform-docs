"""Role refactor: seller/buyer -> partner/resident

Revision ID: a547385bacf7
Revises: fc89012ab345
Create Date: 2026-10-06 20:50:00.000000

Renames the legacy marketplace vocabulary to the resident/partner model and
introduces the partner application + operational status lifecycle.

Every step re-inspects the live schema, so the revision is safe to run both on
databases built from the migration chain and on databases that were bootstrapped
with ``Base.metadata.create_all`` and later stamped. Errors are never swallowed:
a failure aborts the transaction and leaves the schema untouched.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a547385bacf7"
down_revision: Union[str, Sequence[str], None] = "fc89012ab345"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, legacy column, new column)
COLUMN_RENAMES: list[tuple[str, str, str]] = [
    ("menus", "seller_id", "partner_id"),
    ("orders", "seller_id", "partner_id"),
    ("orders", "buyer_id", "resident_id"),
    ("payments", "seller_id", "partner_id"),
    ("payments", "buyer_id", "resident_id"),
    ("payments", "seller_confirmed_at", "partner_confirmed_at"),
    ("payouts", "seller_id", "partner_id"),
    ("ratings", "seller_id", "partner_id"),
    ("ratings", "buyer_id", "resident_id"),
    ("deliveries", "seller_id", "partner_id"),
    ("deliveries", "buyer_id", "resident_id"),
    ("deliveries", "seller_flat", "partner_flat"),
    ("deliveries", "buyer_flat", "resident_flat"),
    ("ledger_entries", "seller_id", "partner_id"),
    ("dish_suggestions", "accepted_by_seller_id", "accepted_by_partner_id"),
    ("partner_profiles", "approval_status", "application_status"),
]

OLD_ROLES = ("buyer", "seller", "admin", "tester", "developer", "maintainer")
NEW_ROLES = ("resident", "partner", "admin", "super_admin")
# Internal tester/developer/maintainer roles carried no privileges in code; they
# are mapped to the least-privileged role rather than silently escalated.
ROLE_UPGRADE_MAP = {
    "buyer": "resident",
    "seller": "partner",
    "admin": "admin",
    "tester": "resident",
    "developer": "resident",
    "maintainer": "resident",
}
ROLE_DOWNGRADE_MAP = {
    "resident": "buyer",
    "partner": "seller",
    "admin": "admin",
    "super_admin": "admin",
}

OLD_APPROVAL = ("pending", "approved", "rejected")
NEW_APPROVAL = ("draft", "pending", "under_review", "approved", "rejected", "withdrawn")
APPROVAL_DOWNGRADE_MAP = {
    "draft": "pending",
    "pending": "pending",
    "under_review": "pending",
    "approved": "approved",
    "rejected": "rejected",
    "withdrawn": "rejected",
}

PARTNER_STATUSES = ("pending", "active", "suspended", "blocked", "inactive")
USER_STATUSES = ("pending_verification", "active", "suspended", "blocked", "deactivated")
VERIFICATION_STATUSES = ("pending", "verified", "rejected")


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _index_names(table: str) -> set[str]:
    return {i["name"] for i in sa.inspect(op.get_bind()).get_indexes(table)}


def _constraint_names(table: str) -> set[str]:
    rows = op.get_bind().execute(
        sa.text(
            "SELECT conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid "
            "WHERE t.relname = :t"
        ),
        {"t": table},
    )
    return {r[0] for r in rows}


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


def _rebuild_enum(
    type_name: str,
    columns: Sequence[tuple[str, str]],
    values: Sequence[str],
    mapping: dict[str, str],
    fallback: str,
) -> None:
    """Replace a native PG enum with ``values`` and remap existing rows.

    Postgres cannot drop enum labels, and labels added with ADD VALUE are not
    usable inside the same transaction, so the type is rebuilt instead.
    """
    tmp = f"{type_name}_new"
    op.execute(f"CREATE TYPE {tmp} AS ENUM ({_quote_values(values)})")
    cases = " ".join(f"WHEN '{old}' THEN '{new}'" for old, new in mapping.items())
    for table, column in columns:
        if table not in _tables() or column not in _columns(table):
            continue
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE {tmp} USING "
            f"(CASE {column}::text {cases} ELSE '{fallback}' END)::{tmp}"
        )
    op.execute(f"DROP TYPE {type_name}")
    op.execute(f"ALTER TYPE {tmp} RENAME TO {type_name}")


def _rename_column(table: str, old: str, new: str) -> None:
    if table not in _tables():
        return
    cols = _columns(table)
    if old not in cols:
        return
    if new in cols:
        raise RuntimeError(f"Cannot rename {table}.{old} -> {new}: both columns exist")
    op.alter_column(table, old, new_column_name=new)
    old_ix, new_ix = f"ix_{table}_{old}", f"ix_{table}_{new}"
    if old_ix in _index_names(table) and new_ix not in _index_names(table):
        op.execute(f"ALTER INDEX {old_ix} RENAME TO {new_ix}")
    old_fk, new_fk = f"{table}_{old}_fkey", f"{table}_{new}_fkey"
    constraints = _constraint_names(table)
    if old_fk in constraints and new_fk not in constraints:
        op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT {old_fk} TO {new_fk}")


def _rename_table(old: str, new: str) -> None:
    tables = _tables()
    if old not in tables:
        return
    if new in tables:
        raise RuntimeError(f"Cannot rename table {old} -> {new}: both tables exist")
    op.rename_table(old, new)
    for suffix in ("pkey", "id_fkey"):
        if f"{old}_{suffix}" in _constraint_names(new):
            op.execute(f"ALTER TABLE {new} RENAME CONSTRAINT {old}_{suffix} TO {new}_{suffix}")
    for ix in _index_names(new):
        if ix.startswith(f"ix_{old}_"):
            op.execute(f"ALTER INDEX {ix} RENAME TO ix_{new}_{ix[len(f'ix_{old}_'):]}")


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        raise RuntimeError("This migration targets PostgreSQL only")

    # 1. Tables and columns
    _rename_table("seller_profiles", "partner_profiles")
    for table, old, new in COLUMN_RENAMES:
        _rename_column(table, old, new)

    # 2. users.role: buyer/seller -> resident/partner, add super_admin
    if set(_enum_values("userrole")) != set(NEW_ROLES):
        _rebuild_enum(
            "userrole", [("users", "role")], NEW_ROLES, ROLE_UPGRADE_MAP, fallback="resident"
        )

    # 3. users.verification_status -> users.status (5-state lifecycle)
    if not _enum_values("userstatus"):
        op.execute(f"CREATE TYPE userstatus AS ENUM ({_quote_values(USER_STATUSES)})")
    if "status" not in _columns("users"):
        op.add_column(
            "users",
            sa.Column(
                "status",
                postgresql.ENUM(*USER_STATUSES, name="userstatus", create_type=False),
                nullable=True,
            ),
        )
        if "verification_status" in _columns("users"):
            op.execute(
                "UPDATE users SET status = (CASE verification_status::text "
                "WHEN 'verified' THEN 'active' "
                "WHEN 'pending' THEN 'pending_verification' "
                "ELSE 'suspended' END)::userstatus"
            )
        op.execute(
            "UPDATE users SET status = 'deactivated' WHERE is_active = false AND status IS NULL"
        )
        op.execute("UPDATE users SET status = 'active' WHERE status IS NULL")
        op.alter_column("users", "status", nullable=False)
    if "verification_status" in _columns("users"):
        op.drop_column("users", "verification_status")
    if _enum_values("verificationstatus"):
        op.execute("DROP TYPE verificationstatus")

    # 4. Partner application lifecycle (approvalstatus gains draft/under_review/withdrawn)
    if set(_enum_values("approvalstatus")) != set(NEW_APPROVAL):
        _rebuild_enum(
            "approvalstatus",
            [("partner_profiles", "application_status")],
            NEW_APPROVAL,
            {v: v for v in NEW_APPROVAL},
            fallback="pending",
        )

    # 5. Operational partner status, derived from the application outcome
    if not _enum_values("partnerstatus"):
        op.execute(f"CREATE TYPE partnerstatus AS ENUM ({_quote_values(PARTNER_STATUSES)})")
    if "partner_status" not in _columns("partner_profiles"):
        op.add_column(
            "partner_profiles",
            sa.Column(
                "partner_status",
                postgresql.ENUM(*PARTNER_STATUSES, name="partnerstatus", create_type=False),
                nullable=True,
            ),
        )
        op.execute(
            "UPDATE partner_profiles SET partner_status = (CASE application_status::text "
            "WHEN 'approved' THEN 'active' "
            "WHEN 'rejected' THEN 'inactive' "
            "ELSE 'pending' END)::partnerstatus"
        )
        op.alter_column("partner_profiles", "partner_status", nullable=False)

    # 6. Partner profiles must carry a photos array (ORM declares it NOT NULL)
    op.execute("UPDATE partner_profiles SET photos = '[]'::json WHERE photos IS NULL")
    op.alter_column("partner_profiles", "photos", existing_type=sa.JSON(), nullable=False)


def downgrade() -> None:
    op.alter_column("partner_profiles", "photos", existing_type=sa.JSON(), nullable=True)

    if "partner_status" in _columns("partner_profiles"):
        op.drop_column("partner_profiles", "partner_status")
    if _enum_values("partnerstatus"):
        op.execute("DROP TYPE partnerstatus")

    _rebuild_enum(
        "approvalstatus",
        [("partner_profiles", "application_status")],
        OLD_APPROVAL,
        APPROVAL_DOWNGRADE_MAP,
        fallback="pending",
    )

    op.execute(f"CREATE TYPE verificationstatus AS ENUM ({_quote_values(VERIFICATION_STATUSES)})")
    op.add_column(
        "users",
        sa.Column(
            "verification_status",
            postgresql.ENUM(*VERIFICATION_STATUSES, name="verificationstatus", create_type=False),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE users SET verification_status = (CASE status::text "
        "WHEN 'active' THEN 'verified' "
        "WHEN 'pending_verification' THEN 'pending' "
        "WHEN 'deactivated' THEN 'verified' "
        "ELSE 'rejected' END)::verificationstatus"
    )
    op.alter_column("users", "verification_status", nullable=False)
    op.drop_column("users", "status")
    op.execute("DROP TYPE userstatus")

    _rebuild_enum("userrole", [("users", "role")], OLD_ROLES, ROLE_DOWNGRADE_MAP, fallback="buyer")

    for table, old, new in reversed(COLUMN_RENAMES):
        _rename_column(table, new, old)
    _rename_table("partner_profiles", "seller_profiles")
