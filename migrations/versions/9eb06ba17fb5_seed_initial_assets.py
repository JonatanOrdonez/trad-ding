"""seed initial assets

Revision ID: 9eb06ba17fb5
Revises: 8b07c897ed34
Create Date: 2026-03-15 15:19:07.728029

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9eb06ba17fb5"
down_revision: Union[str, Sequence[str], None] = "8b07c897ed34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ASSETS = [
    {"name": "ASML Holding N.V.", "symbol": "ASML", "asset_type": "stock"},
    {"name": "Adobe Inc.", "symbol": "ADBD", "asset_type": "stock"},
    {"name": "Bitcoin", "symbol": "BTCUSD", "asset_type": "crypto"},
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
    op.execute("DELETE FROM assets WHERE symbol IN ('ASML', 'ADBD', 'BTCUSD')")
