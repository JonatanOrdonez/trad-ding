from typing import Sequence
from sqlmodel import Session, select
from app.models.asset import Asset


def get_assets(session: Session) -> Sequence[Asset]:
    statement = select(Asset)
    results = session.exec(statement)
    return results.all()


def get_asset_by_symbol(session: Session, symbol: str) -> Asset | None:
    statement = select(Asset).where(Asset.symbol == symbol)
    results = session.exec(statement)
    return results.first()


def delete_asset(session: Session, asset_id) -> None:
    asset = session.get(Asset, asset_id)
    if asset:
        session.delete(asset)
        session.commit()


def create_asset(
    session: Session, name: str, symbol: str, asset_type: str, yfinance_symbol: str
) -> Asset:
    asset = Asset(
        name=name,
        symbol=symbol,
        asset_type=asset_type,
        yfinance_symbol=yfinance_symbol,
    )
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset
