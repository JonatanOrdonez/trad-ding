from fastapi import APIRouter, HTTPException
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
