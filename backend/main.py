import asyncio
from fastapi import FastAPI, HTTPException
from backend.services.training import train_all_assets

app = FastAPI()


@app.get("/")
@app.get("/api")
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Trad-ding API is healthy!"}


@app.get("/train")
async def train():
    try:
        results = await asyncio.to_thread(train_all_assets)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
