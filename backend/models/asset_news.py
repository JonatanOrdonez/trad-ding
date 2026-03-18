from sqlmodel import Field, SQLModel
from sqlalchemy import Column, text
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, timezone
from typing import ClassVar
from enum import Enum
from uuid import UUID, uuid4


class SourceType(str, Enum):
    yfinance = "yfinance"
    newsapi = "newsapi"


class AssetNewsItem(SQLModel, table=True):
    __tablename__: ClassVar[str] = "asset_news"

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    asset_id: UUID | None = Field(default=None, foreign_key="assets.id", nullable=True)
    content_id: str = Field(index=True)
    source_type: SourceType
    content: dict = Field(sa_column=Column(JSONB, nullable=False))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"server_default": text("now()")},
    )

    def to_text(self) -> str:
        if self.source_type == SourceType.yfinance:
            return self._yfinance_content_to_text()
        if self.source_type == SourceType.newsapi:
            return self._newsapi_content_to_text()
        return ""

    def _yfinance_content_to_text(self) -> str:
        title = self.content.get("title", "")
        summary = self.content.get("summary", "")
        pub_date = self.content.get("pubDate", "")
        provider = self.content.get("provider", {}).get("displayName", "")
        url = self.content.get("canonicalUrl", {}).get("url", "")

        parts = [f"Title: {title}"]
        if pub_date:
            parts.append(f"Date: {pub_date}")
        if provider:
            parts.append(f"Source: {provider}")
        if summary:
            parts.append(f"Summary: {summary}")
        if url:
            parts.append(f"URL: {url}")

        return " | ".join(parts)

    def _newsapi_content_to_text(self) -> str:
        title = self.content.get("title", "")
        description = self.content.get("description", "")
        content = self.content.get("content", "")
        author = self.content.get("author", "")
        source = self.content.get("source", {}).get("name", "")
        published_at = self.content.get("publishedAt", "")
        url = self.content.get("url", "")

        parts = [f"Title: {title}"]
        if published_at:
            parts.append(f"Date: {published_at}")
        if source:
            parts.append(f"Source: {source}")
        if author:
            parts.append(f"Author: {author}")
        if description:
            parts.append(f"Description: {description}")
        if content:
            parts.append(f"Content: {content}")
        if url:
            parts.append(f"URL: {url}")

        return " | ".join(parts)
