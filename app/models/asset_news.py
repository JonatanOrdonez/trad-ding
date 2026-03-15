from pydantic import BaseModel
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, text
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from typing import ClassVar
from uuid import UUID


class AssetNewsContent(BaseModel):
    title: str
    description: str
    summary: str
    pubDate: datetime


class AssetNewsItem(SQLModel, table=True):
    __tablename__: ClassVar[str] = "asset_news"

    id: UUID | None = Field(
        default=None,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    asset_id: UUID = Field(foreign_key="assets.id")
    content: dict = Field(sa_column=Column(JSONB, nullable=False))
    created_at: datetime | None = Field(
        default=None,
        sa_column_kwargs={"server_default": text("now()")},
    )

    def get_content(self) -> AssetNewsContent:
        return AssetNewsContent.model_validate(self.content)

    @staticmethod
    def from_content(asset_id: UUID, content: AssetNewsContent) -> "AssetNewsItem":
        return AssetNewsItem(asset_id=asset_id, content=content.model_dump())
