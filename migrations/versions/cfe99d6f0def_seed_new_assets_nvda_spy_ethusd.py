"""seed new assets nvda spy ethusd

Revision ID: cfe99d6f0def
Revises: b8e2b4e7eb34
Create Date: 2026-03-17 16:13:09.939439

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'cfe99d6f0def'
down_revision: Union[str, Sequence[str], None] = 'aef4d1b009d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ASSETS = [
    {"name": "NVIDIA Corporation", "symbol": "NVDA", "asset_type": "stock"},
    {"name": "SPDR S&P 500 ETF Trust", "symbol": "SPY", "asset_type": "etf"},
    {"name": "Ethereum", "symbol": "ETHUSD", "asset_type": "crypto"},
    {"name": "Microsoft Corporation", "symbol": "MSFT", "asset_type": "stock"},
    {"name": "Meta Platforms Inc.", "symbol": "META", "asset_type": "stock"},
]


def upgrade() -> None:
    """Upgrade schema."""
    op.bulk_insert(
        sa.table(
            "assets",
            sa.column("name", sa.String()),
            sa.column("symbol", sa.String()),
            sa.column("asset_type", sa.String()),
        ),
        ASSETS,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM assets WHERE symbol IN ('NVDA', 'SPY', 'ETHUSD', 'MSFT', 'META')")
