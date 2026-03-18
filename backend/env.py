import os
from dotenv import load_dotenv

load_dotenv()


def load_string(var_name: str) -> str:
    value = os.getenv(var_name)
    if value is None:
        raise RuntimeError(f"Environment variable '{var_name}' is not set")
    return value


def load_number(var_name: str) -> int:
    value = os.getenv(var_name)
    if value is None:
        raise RuntimeError(f"Environment variable '{var_name}' is not set")
    try:
        return int(value)
    except ValueError:
        raise RuntimeError(f"Environment variable '{var_name}' is not a valid integer")


DB_USER = load_string("DB_USER")
DB_PASSWORD = load_string("DB_PASSWORD")
DB_HOST = load_string("DB_HOST")
DB_PORT = load_number("DB_PORT")
DB_NAME = load_string("DB_NAME")
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

NEWS_API_KEY = load_string("NEWS_API_KEY")
GROQ_API_KEY = load_string("GROQ_API_KEY")
SUPABASE_URL = load_string("SUPABASE_URL")
SUPABASE_KEY = load_string("SUPABASE_KEY")

