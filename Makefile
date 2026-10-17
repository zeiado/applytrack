.PHONY: install run db migrate migration lint format typecheck test audit check

install:
	uv sync

run:
	uv run uvicorn applytrack.main:app --reload --no-access-log

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
	uvx --from actionlint-py==1.7.12.25 actionlint

format:
	uv run ruff check --fix .
	uv run ruff format .

typecheck:
	uv run mypy

test:
	uv run pytest

# Checks every locked dependency (not just direct ones) against known vulnerabilities.
audit:
	uv export --frozen --no-hashes --no-emit-project --format requirements-txt -o .audit-requirements.txt
	uvx pip-audit==2.10.1 -r .audit-requirements.txt --strict --progress-spinner off
	rm -f .audit-requirements.txt

check: lint typecheck test
