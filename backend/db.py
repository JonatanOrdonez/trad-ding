from sqlmodel import create_engine, Session
from backend.env import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=True)


def get_session():
    """FastAPI dependency — yields a session and closes it automatically."""
    with Session(engine) as session:
        yield session

