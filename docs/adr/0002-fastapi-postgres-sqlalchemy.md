# 2. FastAPI, PostgreSQL and SQLAlchemy 2.0

- Status: Accepted
- Date: 2026-10-17

## Context

We need a typed, well-documented REST API with a relational data model
(users → applications → status changes / interviews) and strong consistency.

## Decision

- **FastAPI** for the web layer: request validation through Pydantic, automatic
  OpenAPI docs, dependency injection for auth and database sessions.
- **PostgreSQL** as the database: relational data, constraints, enums, solid
  indexing. Free managed options exist for deployment.
- **SQLAlchemy 2.0** (typed ORM) with **Alembic** for migrations.
- Synchronous SQLAlchemy sessions for v1.

## Alternatives considered

- **Django + DRF**: more built in (admin, auth), but heavier and less explicit
  about layering. FastAPI shows the architecture more clearly.
- **MongoDB**: the data is relational and needs joins and constraints, so a
  document store adds work without benefit.
- **Async SQLAlchemy**: more throughput under heavy I/O, but more complexity in
  tests and code. Load is low; we can revisit with a new ADR.

## Consequences

- We write the auth layer ourselves (see ADR 0003).
- Tests run against SQLite locally for speed and PostgreSQL in CI, so we stick
  to portable column types and SQLAlchemy constructs.
