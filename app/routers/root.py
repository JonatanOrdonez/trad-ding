from fastapi import APIRouter, Request
from fastapi.responses import FileResponse
from app.db import get_session
from app.repositories import assets as assets_repository

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "OK"}


@router.get("/")
def index():
    return FileResponse("app/static/index.html")


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
