"""Role refactor partner and resident

Revision ID: a547385bacf7
Revises: fc89012ab345
Create Date: 2026-10-06 20:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = 'a547385bacf7'
down_revision: Union[str, Sequence[str], None] = 'fc89012ab345'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # 1. Rename table seller_profiles -> partner_profiles
    if "seller_profiles" in tables and "partner_profiles" not in tables:
        op.rename_table("seller_profiles", "partner_profiles")

    # Helper function to safely rename columns if they exist
    def safe_rename_column(table_name: str, old_col: str, new_col: str):
        if table_name in tables:
            cols = [c["name"] for c in inspector.get_columns(table_name)]
            if old_col in cols and new_col not in cols:
                with op.batch_alter_table(table_name) as batch_op:
                    batch_op.alter_column(old_col, new_column_name=new_col)

    # 2. Rename columns across tables
    safe_rename_column("menus", "seller_id", "partner_id")
    safe_rename_column("orders", "seller_id", "partner_id")
    safe_rename_column("orders", "buyer_id", "resident_id")
    safe_rename_column("deliveries", "seller_id", "partner_id")
    safe_rename_column("deliveries", "buyer_id", "resident_id")
    safe_rename_column("suggestions", "seller_id", "partner_id")
    safe_rename_column("suggestions", "buyer_id", "resident_id")
    safe_rename_column("cravings", "buyer_id", "resident_id")
    safe_rename_column("payouts", "seller_id", "partner_id")
    safe_rename_column("ratings", "seller_id", "partner_id")
    safe_rename_column("ratings", "buyer_id", "resident_id")
    safe_rename_column("daily_ledgers", "seller_id", "partner_id")
    safe_rename_column("payments", "buyer_id", "resident_id")

    # 3. Update existing user roles
    if "users" in tables:
        dialect = conn.dialect.name
        if dialect == "postgresql":
            try:
                op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'resident';")
                op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'partner';")
                op.execute("UPDATE users SET role = 'partner' WHERE role::text = 'seller';")
                op.execute("UPDATE users SET role = 'resident' WHERE role::text = 'buyer';")
            except Exception:
                pass
        else:
            try:
                op.execute("UPDATE users SET role = 'partner' WHERE role = 'seller';")
                op.execute("UPDATE users SET role = 'resident' WHERE role = 'buyer';")
            except Exception:
                pass


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    def safe_rename_column(table_name: str, old_col: str, new_col: str):
        if table_name in tables:
            cols = [c["name"] for c in inspector.get_columns(table_name)]
            if old_col in cols and new_col not in cols:
                with op.batch_alter_table(table_name) as batch_op:
                    batch_op.alter_column(old_col, new_column_name=new_col)

    safe_rename_column("menus", "partner_id", "seller_id")
    safe_rename_column("orders", "partner_id", "seller_id")
    safe_rename_column("orders", "resident_id", "buyer_id")
    safe_rename_column("deliveries", "partner_id", "seller_id")
    safe_rename_column("deliveries", "resident_id", "buyer_id")
    safe_rename_column("suggestions", "partner_id", "seller_id")
    safe_rename_column("suggestions", "resident_id", "buyer_id")
    safe_rename_column("cravings", "resident_id", "buyer_id")
    safe_rename_column("payouts", "partner_id", "seller_id")
    safe_rename_column("ratings", "partner_id", "seller_id")
    safe_rename_column("ratings", "resident_id", "buyer_id")
    safe_rename_column("daily_ledgers", "partner_id", "seller_id")
    safe_rename_column("payments", "resident_id", "buyer_id")

    if "partner_profiles" in tables and "seller_profiles" not in tables:
        op.rename_table("partner_profiles", "seller_profiles")

