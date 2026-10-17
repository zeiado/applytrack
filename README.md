# ApplyTrack

[![CI](https://github.com/zeiado/applytrack/actions/workflows/ci.yml/badge.svg)](https://github.com/zeiado/applytrack/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.12-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A REST API for tracking job applications: where you applied, what stage each one is in,
upcoming interviews, and when to follow up.

Built with **FastAPI**, **PostgreSQL**, **SQLAlchemy 2.0** and **Alembic**, with CI, Docker,
and documented design decisions.

## Features

- [x] Health and readiness checks
- [x] PostgreSQL with Alembic migrations
- [x] Register and log in with JWT (Argon2 password hashing)
- [x] Applications: create, read, update, delete, scoped to the logged-in user
- [x] Filtering, sorting and pagination
- [x] Status workflow with validated transitions and full history
- [x] Interview log
- [ ] Follow-up reminders
- [ ] Stats: response rate, offers by source, time in each stage

See [docs/backlog.md](docs/backlog.md) for the roadmap.

## Quick start

### With Docker

```bash
docker compose up --build
```

This starts PostgreSQL, applies migrations and runs the API.
API: http://localhost:8000 · Interactive docs: http://localhost:8000/docs

### Local development

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv sync
cp .env.example .env
make db       # start PostgreSQL in Docker
make migrate  # apply migrations
make run      # start the API with auto-reload
make check    # lint, type check, test (tests use in-memory SQLite, no database needed)
```

## Try it

1. Open http://localhost:8000/docs
2. `POST /api/v1/auth/register` with an email and password
3. Click **Authorize**, enter the same email (as username) and password
4. Call `GET /api/v1/users/me`

Or with curl:

```bash
curl -X POST localhost:8000/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"email": "ada@example.com", "password": "correct-horse"}'
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -d 'username=ada@example.com&password=correct-horse' | jq -r .access_token)
curl localhost:8000/api/v1/users/me -H "Authorization: Bearer $TOKEN"
```

## Project structure

```
src/applytrack/
  api/          HTTP routers (thin) and dependencies (DB session, current user)
  services/     business rules
  repositories/ database queries
  schemas/      Pydantic request/response models (the API contract)
  models/       SQLAlchemy ORM models
  core/         settings, security, errors
  db/           engine and per-request sessions
migrations/     Alembic migration scripts
docs/
  requirements.md   user stories and requirements
  design.md         architecture, data model, API
  adr/              architecture decision records
tests/
```

## How this project is run

This repo follows a lightweight but complete software development lifecycle:

| Stage | Where |
|-------|-------|
| Requirements | [docs/requirements.md](docs/requirements.md): user stories, MoSCoW priorities, non-functional requirements |
| Design | [docs/design.md](docs/design.md) and [ADRs](docs/adr/) |
| Planning | GitHub issues and milestones ([backlog](docs/backlog.md)) |
| Implementation | Feature branches, Conventional Commits, PR template ([CONTRIBUTING.md](CONTRIBUTING.md)) |
| Testing | pytest unit and integration tests, 85% coverage gate |
| CI | GitHub Actions: ruff, mypy (strict), migration checks and tests on PostgreSQL, Docker build |
| Release | Semantic Versioning and a changelog |

## License

[MIT](LICENSE)
