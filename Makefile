.PHONY: install run db migrate migration lint format typecheck test check

install:
	uv sync

run:
	uv run uvicorn applytrack.main:app --reload

db:
	docker compose up -d db

migrate:
	uv run alembic upgrade head

# Usage: make migration m="add users table"
migration:
	uv run alembic revision --autogenerate -m "$(m)"

lint:
	uv run ruff check .
	uv run ruff format --check .

format:
	uv run ruff check --fix .
	uv run ruff format .

typecheck:
	uv run mypy

test:
	uv run pytest

check: lint typecheck test
