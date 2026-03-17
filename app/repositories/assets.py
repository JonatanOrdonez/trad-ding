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
