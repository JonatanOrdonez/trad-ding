from uuid import UUID
from sqlmodel import Session, select
from app.models.asset_news import AssetNewsItem


def get_asset_new_by_content_id(
    session: Session, content_id: str
) -> AssetNewsItem | None:
    statement = select(AssetNewsItem).where(AssetNewsItem.content_id == content_id)
    results = session.exec(statement)
    return results.first()


def create_asset_news_item(
    session: Session, asset_id: UUID, content_id: str, content: dict
) -> AssetNewsItem:
    asset_news_item = AssetNewsItem(
        asset_id=asset_id,
        content_id=content_id,
        content=content,
    )
    session.add(asset_news_item)
    session.commit()
    session.refresh(asset_news_item)
    return asset_news_item
