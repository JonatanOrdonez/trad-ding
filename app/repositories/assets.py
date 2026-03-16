from typing import Sequence
from sqlmodel import Session, select
from app.models.asset import Asset


def get_assets(session: Session) -> Sequence[Asset]:
    statement = select(Asset)
    results = session.exec(statement)
    return results.all()
