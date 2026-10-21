.PHONY: install run worker test-email db migrate migration lint format typecheck test audit sast check openapi web

install:
	uv sync

run:
	uv run uvicorn applytrack.main:app --reload --no-access-log

# Runs queued jobs, such as emails. With the console backend, emails print here.
worker:
	uv run python -m applytrack.worker

# Usage: make test-email to=you@example.com locale=ar (checks the email provider settings)
test-email:
	uv run python -m applytrack.mail $(to) --locale $(or $(locale),en)

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

# Static security analysis. Free Semgrep registry rules, no account needed; fails on any finding.
sast:
	uvx semgrep==1.181.0 scan --metrics=off --error 		--config p/python --config p/secrets --config p/dockerfile --config p/github-actions --config p/typescript --config p/react --config p/nextjs

check: lint typecheck test

# Regenerate the web app's typed API client after changing the API.
openapi:
	uv run python scripts/export_openapi.py web/openapi.json
	cd web && npm run gen:api

# The web app on http://localhost:3000, talking to the API on :8000 (make run).
web:
	cd web && npm run dev
