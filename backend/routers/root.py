from fastapi import APIRouter, Depends, Request
from sqlmodel import Session
from backend.db import get_session
from backend.repositories import assets as assets_repository

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "OK"}


@router.get("/summary")
def summary(request: Request, session: Session = Depends(get_session)):
    assets = assets_repository.get_assets(session)
    base = str(request.base_url).rstrip("/")
    return [
        {
            "symbol": asset.symbol,
            "name": asset.name,
            "type": asset.asset_type,
            "urls": {
                "news": f"{base}/news/{asset.symbol}",
                "predict": f"{base}/predictions/{asset.symbol}",
            },
        }
        for asset in assets
    ]
