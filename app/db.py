from sqlmodel import create_engine, Session
from app.env import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=True)


def get_session():
    return Session(engine)
