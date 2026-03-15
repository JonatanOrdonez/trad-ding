"""set server default uuid on assets id

Revision ID: f781953040a0
Revises: 66e63b8e0f9b
Create Date: 2026-03-15 15:13:30.651952

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f781953040a0"
down_revision: Union[str, Sequence[str], None] = "66e63b8e0f9b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "assets",
        "id",
        server_default=sa.text("gen_random_uuid()"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("assets", "id", server_default=None)
