import sys
import os

# When deployed from backend/ as Vercel root, add parent dir so `backend` package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: F401
