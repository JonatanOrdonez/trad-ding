from pydantic import BaseModel
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, text
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID, uuid4


class AssetNewsContent(BaseModel):
    title: str
    description: str
    summary: str
    pubDate: datetime


class AssetNewsItem(SQLModel, table=True):
    __tablename__: ClassVar[str] = "asset_news"

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    asset_id: UUID = Field(foreign_key="assets.id")
    content_id: str = Field(index=True)
    content: dict = Field(sa_column=Column(JSONB, nullable=False))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"server_default": text("now()")},
    )

    def get_content(self) -> AssetNewsContent:
        return AssetNewsContent.model_validate(self.content)

    @staticmethod
    def from_content(asset_id: UUID, content: AssetNewsContent) -> "AssetNewsItem":
        return AssetNewsItem(asset_id=asset_id, content=content.model_dump())
