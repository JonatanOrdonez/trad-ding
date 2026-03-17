from fastapi import APIRouter, Request
from app.db import get_session
from app.repositories import assets as assets_repository

router = APIRouter()


@router.get("/health")
def root():
    return {"status": "OK"}


@router.get("/")
@router.get("/docs")
@router.get("/summary")
def summary(request: Request):
    session = get_session()
    try:
        assets = assets_repository.get_assets(session)
    finally:
        session.close()

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
