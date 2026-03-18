# Makefile for the Trad-Ding project

# Run the FastAPI application with auto-reload
run:
	uvicorn app.main:app --reload


# Sync the dependencies in requirements.txt with the current environment
sync-deps:
	pip freeze > requirements.txt


# Install a new dependency and sync the requirements.txt file
install:
	pip install ${dependency} && make sync-deps


# Generate a new migration: make migrate msg="description"
db-migrate:
	alembic revision --autogenerate -m "$(msg)"


# Create a blank migration for seeds: make db-seed msg="description"
db-seed:
	alembic revision -m "$(msg)"


# Apply all pending migrations
db-upgrade:
	alembic upgrade head