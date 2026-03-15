"""set server default on assets created_at

Revision ID: 8b07c897ed34
Revises: f781953040a0
Create Date: 2026-03-15 15:16:31.120645

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "8b07c897ed34"
down_revision: Union[str, Sequence[str], None] = "f781953040a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "assets",
        "created_at",
        existing_type=postgresql.TIMESTAMP(),
        nullable=True,
        server_default=sa.text("now()"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "assets",
        "created_at",
        existing_type=postgresql.TIMESTAMP(),
        nullable=False,
        server_default=None,
    )
