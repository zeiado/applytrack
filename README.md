# ApplyTrack

[![CI](https://github.com/zeiado/applytrack/actions/workflows/ci.yml/badge.svg)](https://github.com/zeiado/applytrack/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.12-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A REST API for tracking job applications: where you applied, what stage each one is in,
upcoming interviews, and when to follow up.

Built with **FastAPI**, **PostgreSQL**, **SQLAlchemy 2.0** and **Alembic**, with CI, Docker,
and documented design decisions.

## Features

- [x] Health check
- [ ] JWT authentication
- [ ] Applications CRUD with filtering, sorting and pagination
- [ ] Status workflow with validated transitions and full history
- [ ] Interview log
- [ ] Follow-up reminders
- [ ] Stats: response rate, offers by source, time in each stage

See [docs/backlog.md](docs/backlog.md) for the roadmap.

## Quick start

### With Docker

```bash
docker compose up --build
```

API: http://localhost:8000 · Interactive docs: http://localhost:8000/docs

### Local development

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv sync
make run      # start the API with auto-reload
make check    # lint, type check, test
```

## Project structure

```
src/applytrack/
  api/          HTTP routers (thin)
  core/         settings, security, logging
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
| CI | GitHub Actions: ruff, mypy (strict), tests on PostgreSQL, Docker build |
| Release | Semantic Versioning and a changelog |

## License

[MIT](LICENSE)
