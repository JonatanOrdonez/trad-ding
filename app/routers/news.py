from fastapi import APIRouter
from app.services import news

router = APIRouter()


@router.get("/news/{asset}")
def get_news(asset: str):
    return news.get_news(asset)
