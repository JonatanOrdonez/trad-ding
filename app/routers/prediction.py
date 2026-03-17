import asyncio
from fastapi import APIRouter, HTTPException
from app.services import analysis

router = APIRouter()


@router.get("/predictions/{symbol}")
async def predict_asset(symbol: str):
    try:
        result = await asyncio.to_thread(analysis.analyze_asset, symbol)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during prediction: {e}")
