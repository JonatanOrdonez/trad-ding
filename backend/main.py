from fastapi import FastAPI
from backend.routers import root, assets, news, training, prediction

app = FastAPI()

app.include_router(root.router)
app.include_router(assets.router)
app.include_router(news.router)
app.include_router(training.router)
app.include_router(prediction.router)
