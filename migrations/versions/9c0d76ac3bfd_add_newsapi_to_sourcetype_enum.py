"""add newsapi to sourcetype enum

Revision ID: 9c0d76ac3bfd
Revises: a2366658d374
Create Date: 2026-03-17 12:07:06.636051

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '9c0d76ac3bfd'
down_revision: Union[str, Sequence[str], None] = 'a2366658d374'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'newsapi'")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM asset_news WHERE source_type = 'newsapi'")
    op.execute("""
        ALTER TYPE sourcetype RENAME TO sourcetype_old;
        CREATE TYPE sourcetype AS ENUM('yfinance');
        ALTER TABLE asset_news ALTER COLUMN source_type TYPE sourcetype USING source_type::text::sourcetype;
        DROP TYPE sourcetype_old;
    """)
