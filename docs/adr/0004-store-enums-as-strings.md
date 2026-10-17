# 4. Store enums as strings with CHECK constraints

- Status: Accepted
- Date: 2026-10-17

## Context

`applications.status` and `applications.source` take a fixed set of values.
PostgreSQL has a native `ENUM` type, but changing one is awkward: adding a value
needs `ALTER TYPE ... ADD VALUE` (which can't run inside a transaction on older
versions), removing or renaming a value means recreating the type, and Alembic
autogenerate doesn't detect enum changes. SQLite, used for local tests, has no
enum type at all.

## Decision

Store these columns as `VARCHAR(20)` with a named `CHECK (col IN (...))`
constraint (`native_enum=False, create_constraint=True` in SQLAlchemy). Python
code uses `StrEnum` classes in `models/enums.py`, and Pydantic validates input
against them.

## Consequences

- Invalid values are still rejected by the database, not just by the API.
- Adding a value is an ordinary migration: drop and recreate one CHECK constraint.
- The same schema works on PostgreSQL and SQLite.
- Slightly larger storage than a native enum. Irrelevant at this scale.
- Alembic doesn't compare CHECK constraints, so enum changes need a hand-written
  migration. Reviewers should look for one whenever `models/enums.py` changes.
