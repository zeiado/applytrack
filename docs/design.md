# Design

## Architecture

A single FastAPI service backed by PostgreSQL. The code is split into layers so
business rules don't depend on HTTP or the database driver.

```
HTTP request
   │
   ▼
api/        Routers: parse input, call a service, shape the response. No business logic.
   │
   ▼
services/   Business rules: status transitions, ownership checks, reminders.
   │
   ▼
repositories/  Database queries (SQLAlchemy). The only layer that touches the session.
   │
   ▼
PostgreSQL
```

Other modules:

- `core/` – settings, security (hashing, JWT), logging, error handling
- `models/` – SQLAlchemy ORM tables
- `schemas/` – Pydantic request/response models (the API contract)

Keeping routers thin means services can be unit tested without spinning up HTTP,
and repositories can be swapped or mocked.

## Data model

```
users
  id            UUID  PK
  email         text  unique, not null
  password_hash text  not null
  created_at    timestamptz

applications
  id             UUID PK
  user_id        UUID FK → users.id (on delete cascade), indexed
  company        text not null
  role_title     text not null
  job_url        text
  source         enum(referral, job_board, company_site, recruiter, other)
  status         enum(see below), indexed
  salary_min     int
  salary_max     int
  applied_on     date
  follow_up_on   date, indexed
  notes          text
  created_at / updated_at timestamptz

status_changes
  id              UUID PK
  application_id  UUID FK → applications.id (on delete cascade)
  from_status     enum, nullable (null for the first entry)
  to_status       enum
  changed_at      timestamptz

interviews
  id              UUID PK
  application_id  UUID FK → applications.id (on delete cascade)
  scheduled_at    timestamptz
  kind            enum(phone_screen, technical, behavioral, onsite, other)
  interviewer     text
  notes           text
```

## Status workflow

```
wishlist ──► applied ──► screening ──► interviewing ──► offer ──► accepted
                │            │              │              │
                └────────────┴──────────────┴──────────────┴──► rejected
any non-final status ──► withdrawn
```

Final statuses: `accepted`, `rejected`, `withdrawn`. Moving out of a final
status is not allowed. The transition table lives in one place in
`services/` and is covered by table-driven tests.

## API (v1)

All routes are under `/api/v1`. Data routes require `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get access token |
| GET | `/users/me` | Current user |
| GET | `/applications` | List (filters: `status`, `company`, `source`; `limit`, `offset`, `sort`) |
| POST | `/applications` | Create |
| GET | `/applications/{id}` | Get one |
| PATCH | `/applications/{id}` | Update fields |
| DELETE | `/applications/{id}` | Delete |
| POST | `/applications/{id}/status` | Change status (validated) |
| GET | `/applications/{id}/history` | Status history |
| GET/POST | `/applications/{id}/interviews` | List / add interviews |
| GET | `/reminders/due` | Applications whose follow-up date has arrived |
| GET | `/stats` | Aggregate stats |
| GET | `/health` | Liveness (no auth) |
| GET | `/ready` | Readiness: checks the database (no auth) |

### Error format

```json
{ "error": { "code": "invalid_transition", "message": "Cannot move from rejected to applied" } }
```

## Testing strategy

| Level | What | Tools |
|-------|------|-------|
| Unit | Services and pure logic (transitions, stats) | pytest |
| Integration | Routers + real database through the HTTP client | pytest, httpx, SQLite locally / Postgres in CI |
| Contract | OpenAPI schema is generated and checked in CI | FastAPI |

## Delivery

- Trunk-based: short-lived feature branches off `main`, merged by PR.
- Conventional Commits (`feat:`, `fix:`, `docs:`, ...) so the changelog can be generated.
- CI on every PR: ruff, mypy, pytest with coverage, Docker build.
- Semantic Versioning; tagged releases publish a Docker image.
