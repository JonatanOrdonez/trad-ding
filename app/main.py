from fastapi import FastAPI
from app.routers import root, news

app = FastAPI()

app.include_router(root.router)
app.include_router(news.router)
