from datetime import datetime
from enum import Enum
from typing import ClassVar
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Field, SQLModel


class AssetType(str, Enum):
    stock = "stock"
    crypto = "crypto"


class Asset(SQLModel, table=True):
    __tablename__: ClassVar[str] = "assets"

    id: UUID | None = Field(
        default=None,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    symbol: str
    name: str
    asset_type: AssetType
    created_at: datetime | None = Field(
        default=None,
        sa_column_kwargs={"server_default": text("now()")},
    )
