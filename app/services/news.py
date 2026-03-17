from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import yfinance as yf

logger = logging.getLogger(__name__)
from newsapi import NewsApiClient
from sqlmodel import Session
from app.db import get_session
from app.env import NEWS_API_KEY
from app.models.asset import Asset
from app.models.asset_news import SourceType
from app.repositories import assets as assets_repository
from app.repositories import asset_news as asset_news_repository
from app.types.news import AssetNewsResult


def _get_news_by_asset(asset_symbol: str) -> list[dict]:
    return yf.Ticker(asset_symbol).news


def _update_news_by_asset(session: Session, asset: Asset, news: list[dict]) -> None:
    for news_item in news:
        content_id = news_item["id"]

        if content_id is None:
            logger.warning(f"News item for asset {asset.id} is missing an id, skipping")
            continue

        asset_item = asset_news_repository.get_asset_new_by_content_id(
            session, str(content_id)
        )

        if asset_item is not None:
            logger.debug(f"asset_item {content_id} already exists, skipping")
            continue

        content = news_item["content"]

        if content is None:
            logger.warning(f"News item for asset {asset.id} is missing content, skipping")
            continue

        asset_news_repository.create_asset_news_item(
            session,
            asset.id,
            content_id,
            SourceType.yfinance,
            content,
        )


def _sync_news_by_asset_threadsafe(asset: Asset) -> None:
    session = get_session()
    try:
        news = _get_news_by_asset(asset.symbol)
        _update_news_by_asset(session, asset, news)
    finally:
        session.close()


def _get_world_news() -> list[dict]:
    client = NewsApiClient(api_key=NEWS_API_KEY)
    response = client.get_top_headlines(
        category="business",
        language="en",
    )
    return response.get("articles", [])


def _sync_world_news_threadsafe() -> None:
    session = get_session()
    try:
        articles = _get_world_news()
        for article in articles:
            content_id = article.get("url")

            if content_id is None:
                logger.warning("World news article is missing a url, skipping")
                continue

            existing = asset_news_repository.get_asset_new_by_content_id(
                session, content_id
            )
            if existing is not None:
                logger.debug(f"World news article {content_id} already exists, skipping")
                continue

            asset_news_repository.create_asset_news_item(
                session,
                None,
                content_id,
                SourceType.newsapi,
                article,
            )
    finally:
        session.close()


def get_news_by_asset(
    symbol: str | None = None, offset: int = 0, limit: int = 20
) -> list[AssetNewsResult]:
    session = get_session()
    try:
        if symbol is None:
            news_items = asset_news_repository.get_general_news(session, offset, limit)
        else:
            asset = assets_repository.get_asset_by_symbol(session, symbol)
            if asset is None:
                raise ValueError(f"Asset with symbol {symbol} not found")
            news_items = asset_news_repository.get_news_by_asset_id(session, asset.id, offset, limit)

        return [
            AssetNewsResult(
                id=item.id,
                summary=item.to_text(),
                source_type=item.source_type,
                content=item.content,
            )
            for item in news_items
        ]
    finally:
        session.close()


def sync_news() -> None:
    session = get_session()
    assets = assets_repository.get_assets(session)
    session.close()
    with ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(_sync_news_by_asset_threadsafe, asset) for asset in assets
        ]
        futures.append(executor.submit(_sync_world_news_threadsafe))
        for future in as_completed(futures):
            future.result()
