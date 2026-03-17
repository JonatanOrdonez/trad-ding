"""add yfinance_symbol to assets

Revision ID: b73e67b2e958
Revises: cfe99d6f0def
Create Date: 2026-03-17 16:42:40.918610

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'b73e67b2e958'
down_revision: Union[str, Sequence[str], None] = 'cfe99d6f0def'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("assets", sa.Column("yfinance_symbol", sa.String(), nullable=True))
    op.execute("UPDATE assets SET yfinance_symbol = symbol")
    op.alter_column("assets", "yfinance_symbol", nullable=False)
    op.execute("UPDATE assets SET yfinance_symbol = 'BTC-USD' WHERE symbol = 'BTCUSD'")
    op.execute("UPDATE assets SET yfinance_symbol = 'ETH-USD' WHERE symbol = 'ETHUSD'")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("assets", "yfinance_symbol")
