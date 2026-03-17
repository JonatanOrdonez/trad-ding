from fastapi import APIRouter, HTTPException, Query
from app.services import news

router = APIRouter()


@router.get("/news/sync")
def sync_news():
    try:
        news.sync_news()
        return {"message": "News synchronization completed successfully."}
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error during news synchronization: {e}"
        )


@router.get("/news")
@router.get("/news/{symbol}")
def get_news_by_asset(
    symbol: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    try:
        news_items = news.get_news_by_asset(symbol, offset, limit)
        return {"news": news_items}
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error during news synchronization: {e}"
        )
