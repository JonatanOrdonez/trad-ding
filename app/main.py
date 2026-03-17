from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.routers import root, assets, news, training, prediction

app = FastAPI()

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(root.router)
app.include_router(assets.router)
app.include_router(news.router)
app.include_router(training.router)
app.include_router(prediction.router)
