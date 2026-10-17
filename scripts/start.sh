#!/bin/sh
# Container entrypoint: apply pending migrations, then start the API.
set -e
alembic upgrade head
exec uvicorn applytrack.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
