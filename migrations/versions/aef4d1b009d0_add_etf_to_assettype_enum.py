"""add etf to assettype enum

Revision ID: aef4d1b009d0
Revises: cfe99d6f0def
Create Date: 2026-03-17 16:17:16.005944

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'aef4d1b009d0'
down_revision: Union[str, Sequence[str], None] = 'b8e2b4e7eb34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'etf'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
