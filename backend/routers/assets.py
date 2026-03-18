import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session
from backend.db import get_session
from backend.models.asset import AssetType
from backend.repositories import assets as assets_repository
from backend.repositories import asset_models as asset_models_repository
from backend.repositories import asset_news as asset_news_repository
from backend.supabase import get_supabase

BUCKET = "ml-models"

router = APIRouter()


class CreateAssetRequest(BaseModel):
    name: str
    symbol: str
    asset_type: AssetType
    yfinance_symbol: str


def _validate_yfinance_symbol(yfinance_symbol: str) -> None:
    """SRP: validation lives here, not in the route handler."""
    df = yf.Ticker(yfinance_symbol).history(period="5d")
    if df.empty:
        raise HTTPException(
            status_code=422,
            detail=f"'{yfinance_symbol}' was not recognized by Yahoo Finance. Check the symbol and try again.",
        )


@router.delete("/assets/{symbol}")
def delete_asset(symbol: str, session: Session = Depends(get_session)):
    asset = assets_repository.get_asset_by_symbol(session, symbol.upper())
    if asset is None:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not found.")

    models = asset_models_repository.get_all_models(session, asset.id)
    storage_paths = [m.storage_path for m in models]

    asset_news_repository.delete_news_by_asset_id(session, asset.id)
    asset_models_repository.delete_models_by_asset_id(session, asset.id)
    assets_repository.delete_asset(session, asset.id)

    if storage_paths:
        get_supabase().storage.from_(BUCKET).remove(storage_paths)

    return {"deleted": symbol.upper()}


@router.post("/assets")
def create_asset(body: CreateAssetRequest, session: Session = Depends(get_session)):
    existing = assets_repository.get_asset_by_symbol(session, body.symbol.upper())
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Asset with symbol '{body.symbol}' already exists."
        )

    # Validate yfinance symbol before creating (pure side-effect check)
    _validate_yfinance_symbol(body.yfinance_symbol)

    asset = assets_repository.create_asset(
        session,
        name=body.name,
        symbol=body.symbol.upper(),
        asset_type=body.asset_type,
        yfinance_symbol=body.yfinance_symbol,
    )
    return {"id": asset.id, "symbol": asset.symbol, "name": asset.name}

