"""fix orderstatus enums and column renames

Revision ID: c789123ef456
Revises: a547385bacf7
Create Date: 2026-10-08 23:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision: str = "c789123ef456"
down_revision: Union[str, Sequence[str], None] = "a547385bacf7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # 1. Update PostgreSQL orderstatus enum values
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'placed';")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'confirmed';")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'preparing';")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'out_for_delivery';")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'delivered';")

    # 2. Rename column in dish_suggestions if accepted_by_seller_id exists
    if "dish_suggestions" in tables:
        cols = [c["name"] for c in inspector.get_columns("dish_suggestions")]
        if "accepted_by_seller_id" in cols and "accepted_by_partner_id" not in cols:
            with op.batch_alter_table("dish_suggestions") as batch_op:
                batch_op.alter_column(
                    "accepted_by_seller_id", new_column_name="accepted_by_partner_id"
                )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if "dish_suggestions" in tables:
        cols = [c["name"] for c in inspector.get_columns("dish_suggestions")]
        if "accepted_by_partner_id" in cols and "accepted_by_seller_id" not in cols:
            with op.batch_alter_table("dish_suggestions") as batch_op:
                batch_op.alter_column(
                    "accepted_by_partner_id", new_column_name="accepted_by_seller_id"
                )
