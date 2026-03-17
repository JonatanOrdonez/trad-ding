import asyncio
from fastapi import APIRouter, HTTPException
from app.services import training

router = APIRouter()


@router.get("/train")
async def train_all_assets():
    try:
        results = await asyncio.to_thread(training.train_all_assets)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during training: {e}")
