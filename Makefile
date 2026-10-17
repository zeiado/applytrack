.PHONY: install run lint format typecheck test check

install:
	uv sync

run:
	uv run uvicorn applytrack.main:app --reload

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
