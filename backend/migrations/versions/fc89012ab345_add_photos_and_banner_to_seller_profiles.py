"""add_photos_and_banner_to_seller_profiles

Revision ID: fc89012ab345
Revises: ea7fe3ab7835
Create Date: 2026-09-24 23:55:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fc89012ab345"
down_revision: Union[str, Sequence[str], None] = "ea7fe3ab7835"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("seller_profiles", sa.Column("banner_url", sa.String(length=500), nullable=True))
    op.add_column(
        "seller_profiles",
        sa.Column("photos", sa.JSON(), nullable=True, server_default=sa.text("'[]'")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("seller_profiles", "photos")
    op.drop_column("seller_profiles", "banner_url")
