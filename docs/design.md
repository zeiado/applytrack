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
  id              integer PK (insertion order)
  application_id  UUID FK → applications.id (on delete cascade)
  from_status     enum, nullable (null for the first entry)
  to_status       enum
  note            text
  changed_at      timestamptz

interviews
  id                UUID PK
  application_id    UUID FK → applications.id (on delete cascade)
  scheduled_at      timestamptz          index (application_id, scheduled_at)
  kind              enum(phone_screen, technical, behavioral, onsite, other)
  duration_minutes  int, 1–1440
  interviewer       text
  notes             text
```

## Status workflow

```
wishlist ──► applied ──► screening ──► interviewing ──► offer ──► accepted
                │  └─────────────────────►┘ │              │
                └──────────┴────────────────┴──────────────┴──► rejected
any non-final status ──► withdrawn
```

- Final statuses: `accepted`, `rejected`, `withdrawn`. Nothing moves out of them.
- `applied → interviewing` is allowed because many companies have no screening step.
- Declining an offer is `offer → withdrawn`; a rescinded offer is `offer → rejected`.
- The rules live in one pure module, `services/workflow.py`, tested for all 64
  (from, to) pairs against a table written separately in the test.
- An invalid move returns `409 invalid_transition` with the allowed statuses in
  `details`. Every application response includes `next_statuses`, so clients can
  show only valid options.

**History.** Each change appends a row to `status_changes` (from, to, optional note,
time). Creating an application records the first row (`from_status = null`). Rows are
never updated. They're ordered by an integer id, so the order is exact even when two
changes share a timestamp.

**Concurrency.** A status change locks the application row (`SELECT ... FOR UPDATE`)
until it commits. Without the lock, two simultaneous requests could both read
`applied`, both pass validation, and leave a history that never happened. A
PostgreSQL-only test runs two threads against the same application and checks
that exactly one succeeds. It fails when the lock is removed.

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

### Interviews

Interviews are nested under their application:
`/applications/{id}/interviews` and `/applications/{id}/interviews/{interview_id}`.

- `scheduled_at` must include a timezone (`2026-10-20T14:00:00+03:00`); a time
  without one is rejected, because "2pm" means different moments in Cairo and
  London. It's stored and returned in UTC.
- The application is checked first, so another user's application gives `404`
  for every interview route. An interview id only works under its own application.
- Interviews are listed earliest first. Deleting an application deletes its interviews.

### Lists and pagination

List endpoints return one page plus the total number of matches:

```json
{ "items": [ ... ], "total": 42, "limit": 20, "offset": 0 }
```

- `limit` defaults to 20 (max 100); `offset` defaults to 0.
- `GET /applications` filters: `status` and `source` (repeat to match several:
  `?status=applied&status=screening`), `company` (case-insensitive substring;
  `%` and `_` are matched literally).
- `sort`: `created_at`, `applied_on` or `company`; prefix with `-` for descending.
  Default `-created_at`. Missing dates sort last in both directions, and `id` breaks
  ties, so pages never overlap or skip rows.
- Unknown query parameters return `422` instead of being silently ignored.

Offset pagination is simple and lets clients jump to any page. Its weakness (slow deep
pages, rows shifting while you page) doesn't matter at one user's scale; keyset
pagination would be the upgrade if lists grew large.

### Error format

Every error, whether raised by our code or by the framework, uses one shape:

```json
{ "error": { "code": "invalid_transition", "message": "Cannot move from rejected to applied" } }
```

Validation errors add a `details` list:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [{ "field": "body.salary_min", "message": "Input should be a valid integer", "type": "int_parsing" }]
  }
}
```

| Status | `code` | Raised by |
|--------|--------|-----------|
| 401 | `unauthorized` | `UnauthorizedError` (adds `WWW-Authenticate: Bearer`) |
| 404 | `not_found` | `NotFoundError`, unknown routes |
| 405 | `method_not_allowed` | wrong HTTP method |
| 409 | `conflict` or a specific code | `ConflictError` |
| 422 | `validation_error` | invalid request body, query or path |
| 500 | `internal_error` | anything unexpected; logged with a stack trace, details never sent to the client |

Services raise `AppError` subclasses from `core/errors.py`, never `HTTPException`,
so business logic doesn't depend on the web framework.

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
