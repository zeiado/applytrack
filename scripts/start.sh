#!/bin/sh
# Container entrypoint: apply pending migrations, then start the API.
set -e
# Migrations time out instead of hanging (migrations/env.py); retry a couple of times so
# a database that's still waking up doesn't fail the deploy.
attempt=1
until alembic upgrade head; do
  if [ "$attempt" -ge 3 ]; then
    echo "Migrations failed $attempt times; giving up." >&2
    exit 1
  fi
  echo "Migrations failed (attempt $attempt); retrying in 10 seconds." >&2
  attempt=$((attempt + 1))
  sleep 10
done
exec uvicorn applytrack.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
