from sqlmodel import Field, SQLModel
from sqlalchemy import Column, text
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4


class AssetModel(SQLModel, table=True):
    __tablename__: ClassVar[str] = "asset_models"

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    asset_id: UUID = Field(foreign_key="assets.id", nullable=False)
    storage_path: str
    metrics: dict = Field(sa_column=Column(JSONB, nullable=False))
    features: dict = Field(sa_column=Column(JSONB, nullable=False))
    is_active: bool = Field(default=False)
    trained_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"server_default": text("now()")},
    )
