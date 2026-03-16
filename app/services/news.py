from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf
from sqlmodel import Session
from app.db import get_session
from app.models.asset import Asset
from app.repositories import assets as assets_repository
from app.repositories import asset_news as asset_news_repository


def _get_news_by_asset(asset_symbol: str) -> list[dict]:
    return yf.Ticker(asset_symbol).news


def _update_news_by_asset(session: Session, asset: Asset, news: list[dict]) -> None:
    for news_item in news:
        content_id = news_item["id"]

        if content_id is None:
            print(f"News item for asset {asset.id} is missing an id, skipping")
            continue

        asset_item = asset_news_repository.get_asset_new_by_content_id(
            session, str(content_id)
        )

        if asset_item is not None:
            print(f"asset_item {content_id} already exists, skipping")
            continue

        content = news_item["content"]

        if content is None:
            print(f"News item for asset {asset.id} is missing content, skipping")
            continue

        asset_news_repository.create_asset_news_item(
            session, asset.id, content_id, content
        )


def _sync_news_by_asset_threadsafe(asset: Asset) -> None:
    session = get_session()
    try:
        news = _get_news_by_asset(asset.symbol)
        _update_news_by_asset(session, asset, news)
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
        for future in as_completed(futures):
            future.result()
    print("Sincronización de noticias finalizada.")
