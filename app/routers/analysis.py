from fastapi import APIRouter, HTTPException
from app.services import analysis

router = APIRouter()


@router.get("/predictions/{symbol}")
def get_asset_analysis(symbol: str):
    try:
        result = analysis.analyze_asset(symbol)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during analysis: {e}")
