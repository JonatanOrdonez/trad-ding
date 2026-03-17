import os
from dotenv import load_dotenv

load_dotenv()


def loadString(var_name: str) -> str:
    value = os.getenv(var_name)
    if value is None:
        raise RuntimeError(f"Environment variable '{var_name}' is not set")
    return value


def loadNumber(var_name: str) -> int:
    value = os.getenv(var_name)
    if value is None:
        raise RuntimeError(f"Environment variable '{var_name}' is not set")
    try:
        return int(value)
    except ValueError:
        raise RuntimeError(f"Environment variable '{var_name}' is not a valid integer")


DB_USER = loadString("DB_USER")
DB_PASSWORD = loadString("DB_PASSWORD")
DB_HOST = loadString("DB_HOST")
DB_PORT = loadNumber("DB_PORT")
DB_NAME = loadString("DB_NAME")
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

NEWS_API_KEY = loadString("NEWS_API_KEY")
GROQ_API_KEY = loadString("GROQ_API_KEY")
