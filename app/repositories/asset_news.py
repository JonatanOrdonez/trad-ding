from uuid import UUID
from sqlmodel import Session, select
from sqlalchemy import desc
from app.models.asset_news import AssetNewsItem, SourceType


def get_asset_new_by_content_id(
    session: Session, content_id: str
) -> AssetNewsItem | None:
    statement = select(AssetNewsItem).where(AssetNewsItem.content_id == content_id)
    results = session.exec(statement)
    return results.first()


def get_news_by_asset_id(
    session: Session, asset_id: UUID, offset: int = 0, limit: int = 20
) -> list[AssetNewsItem]:
    statement = (
        select(AssetNewsItem)
        .where(AssetNewsItem.asset_id == asset_id)
        .order_by(desc(AssetNewsItem.created_at))
        .offset(offset)
        .limit(limit)
    )
    results = session.exec(statement)
    return list(results.all())


def get_general_news(
    session: Session, offset: int = 0, limit: int = 20
) -> list[AssetNewsItem]:
    statement = (
        select(AssetNewsItem)
        .where(AssetNewsItem.asset_id == None)  # noqa: E711
        .order_by(desc(AssetNewsItem.created_at))
        .offset(offset)
        .limit(limit)
    )
    results = session.exec(statement)
    return list(results.all())


def delete_news_by_asset_id(session: Session, asset_id: UUID) -> None:
    items = session.exec(
        select(AssetNewsItem).where(AssetNewsItem.asset_id == asset_id)
    ).all()
    for item in items:
        session.delete(item)
    session.commit()


def create_asset_news_item(
    session: Session,
    asset_id: UUID | None,
    content_id: str,
    source_type: SourceType,
    content: dict,
) -> AssetNewsItem:
    asset_news_item = AssetNewsItem(
        asset_id=asset_id,
        content_id=content_id,
        content=content,
        source_type=source_type,
    )
    session.add(asset_news_item)
    session.commit()
    session.refresh(asset_news_item)
    return asset_news_item
