# Makefile for the trad-ding backend (run from backend/ directory)

ROOT := $(shell cd .. && pwd)

# ── Dev server ────────────────────────────────────────────────────────────────

run:
	cd $(ROOT) && uvicorn backend.main:app --reload


# ── Dependencies ──────────────────────────────────────────────────────────────

sync-deps:
	pip freeze > requirements.txt

install:
	pip install ${dependency} && make sync-deps


# ── Alembic migrations ────────────────────────────────────────────────────────

db-upgrade:
	cd $(ROOT) && alembic -c backend/alembic.ini upgrade head

db-migrate:
	cd $(ROOT) && alembic -c backend/alembic.ini revision --autogenerate -m "$(msg)"

db-seed:
	cd $(ROOT) && alembic -c backend/alembic.ini revision -m "$(msg)"
