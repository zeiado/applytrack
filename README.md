# ApplyTrack

[![CI](https://github.com/zeiado/applytrack/actions/workflows/ci.yml/badge.svg)](https://github.com/zeiado/applytrack/actions/workflows/ci.yml)
[![Semgrep](https://github.com/zeiado/applytrack/actions/workflows/semgrep.yml/badge.svg)](https://github.com/zeiado/applytrack/actions/workflows/semgrep.yml)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Python](https://img.shields.io/badge/python-3.12%20%7C%203.14-blue)
![mypy](https://img.shields.io/badge/mypy-strict-blue)
![License](https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey)

**A production-style REST API for tracking a job search:** every application, the stage it's
in, its full status history, interviews, follow-up reminders and stats on what's working.

It's built as a small but complete piece of software engineering: written requirements
and design docs, architecture decision records, issue-driven development through
reviewed pull requests, 350+ automated tests on two databases, strict typing, security
scanning, and tag-driven releases of a Docker image with build provenance.

**Live:** [production API docs](https://applytrack-production-jxnw.onrender.com/docs) · [staging](https://applytrack-staging-jxnw.onrender.com/docs) (free plan: the first request after 15 idle minutes takes about a minute)

---

## Contents

- [Why](#why)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [API](#api)
- [Engineering highlights](#engineering-highlights)
- [Quality and testing](#quality-and-testing)
- [CI/CD](#cicd)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [How this project was built](#how-this-project-was-built)
- [Roadmap](#roadmap)

---

## Why

Job seekers juggle dozens of applications across spreadsheets, inboxes and memory.
Follow-ups get forgotten, interview dates get lost, and nobody can say whether referrals
actually work better than job boards. ApplyTrack keeps it all in one place and answers
that question with data. See the [requirements](docs/requirements.md) for the user
stories and priorities.

## Features

| Area | What it does |
|------|--------------|
| **Accounts** | Register, verify the email by link, log in, and reset a forgotten password by email. Argon2id password hashing, short-lived JWT access tokens, rotating refresh tokens with reuse detection, logout, failed-login rate limiting |
| **Applications** | Create, read, update (partial) and delete. Company, role, link, source, salary range, dates, notes |
| **Search** | Filter by status, source and company (case-insensitive), sort on three fields, paginate with totals |
| **Status workflow** | `wishlist → applied → screening → interviewing → offer → accepted` with validated transitions, `rejected`/`withdrawn` exits, and an append-only history |
| **Interviews** | Log interviews per application, with timezone-aware times stored in UTC |
| **Reminders** | Applications due for a follow-up today *in your timezone*, most overdue first, and a morning email listing them (Arabic or English) |
| **Stats** | Response, interview and offer rates; results by source; average days spent in each stage |
| **Your data** | Download everything as JSON, or delete the account and all its data (Egypt PDPL 151/2020) |
| **Export** | Streamed CSV download, safe to open in Excel (formula-injection escaping, UTF-8 BOM for Arabic text) |
| **Email** | Background jobs in PostgreSQL with retries; Arabic and English templates; console, Resend or any SMTP provider, chosen by config |
| **Operations** | Liveness and readiness probes, request ids, structured JSON logs, one consistent error format |

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | Python 3.12+ (tested on 3.12 and 3.14) | Typed, fast to build with |
| Web framework | FastAPI + Pydantic v2 | Validation from type hints, OpenAPI docs for free, dependency injection |
| Database | PostgreSQL 17 | Relational data with constraints ([ADR 0002](docs/adr/0002-fastapi-postgres-sqlalchemy.md)) |
| ORM and migrations | SQLAlchemy 2.0 (typed) + Alembic | Explicit queries, versioned schema |
| Auth | PyJWT + pwdlib (Argon2id) | Stateless tokens ([ADR 0003](docs/adr/0003-jwt-authentication.md)) |
| Background jobs and email | A job table in PostgreSQL, Jinja2 templates, Resend or SMTP | No extra infrastructure; jobs commit with the change that caused them ([ADR 0007](docs/adr/0007-database-job-queue-and-email.md)) |
| Tooling | uv, Ruff, mypy `--strict`, pytest, pre-commit | Fast, reproducible, strict |
| Delivery | Docker (multi-stage, non-root), GitHub Actions, GHCR | Same image from CI to production |
| Web app | Next.js, TypeScript, Tailwind CSS, shadcn/ui, next-intl | Arabic and English with RTL; typed client generated from the OpenAPI schema ([ADR 0010](docs/adr/0010-web-app.md)) |
| Security | pip-audit, Semgrep, Dependabot, actionlint | Known-vulnerability and code scanning on every PR |

---

## Architecture

A single service with a strict layered design. Routers handle HTTP only, services hold
the business rules, and repositories are the only code that talks to the database.
That keeps the rules testable without HTTP, and every query scoped to one user.

```mermaid
flowchart LR
    client([Client]) --> mw

    subgraph app [FastAPI app]
        direction LR
        mw["RequestContext middleware<br/><sub>request id · access log · last-resort 500</sub>"]
        mw --> routers["api/routes<br/><sub>validate input, shape output</sub>"]
        routers --> deps["api/deps<br/><sub>DB session · current user · clock</sub>"]
        routers --> services["services<br/><sub>workflow · stats · reminders · export</sub>"]
        services --> repos["repositories<br/><sub>user-scoped SQL</sub>"]
    end

    repos --> db[(PostgreSQL)]
    routers -.->|"errors (AppError)"| handlers["core/errors<br/><sub>one JSON error shape</sub>"]
    services -.->|"Mailer.send: queue a job"| db
    db -.->|"due jobs"| worker["worker<br/><sub>retries · housekeeping</sub>"]
    worker --> provider([Email provider])
```

Some of the business logic is written as **pure functions with no I/O**, so it's
unit-tested with hand-made data: the status workflow (`services/workflow.py`), stats
(`services/stats.py`) and CSV writing (`services/export.py`).

### Data model

```mermaid
erDiagram
    USERS ||--o{ APPLICATIONS : owns
    APPLICATIONS ||--o{ STATUS_CHANGES : "history of"
    APPLICATIONS ||--o{ INTERVIEWS : has

    USERS {
        uuid id PK
        string email UK
        string password_hash
        timestamptz created_at
    }
    APPLICATIONS {
        uuid id PK
        uuid user_id FK
        string company
        string role_title
        string status "CHECK constraint"
        string source "CHECK constraint"
        int salary_min "CHECK min <= max"
        int salary_max
        date applied_on
        date follow_up_on
        text notes
    }
    STATUS_CHANGES {
        int id PK "insertion order"
        uuid application_id FK
        string from_status
        string to_status
        text note
        timestamptz changed_at
    }
    INTERVIEWS {
        uuid id PK
        uuid application_id FK
        timestamptz scheduled_at
        string kind
        int duration_minutes
        string interviewer
    }
```

All foreign keys cascade on delete. Indexes match the real queries:
`(user_id, created_at)` for the default list and `(user_id, follow_up_on)` for
reminders. Enums are stored as strings with CHECK constraints so that adding a value
is a simple migration ([ADR 0004](docs/adr/0004-store-enums-as-strings.md)).

### Status workflow

```mermaid
stateDiagram-v2
    direction LR
    [*] --> wishlist
    [*] --> applied
    wishlist --> applied
    applied --> screening
    applied --> interviewing : no screening step
    screening --> interviewing
    interviewing --> offer
    offer --> accepted
    applied --> rejected
    screening --> rejected
    interviewing --> rejected
    offer --> rejected : offer rescinded
    wishlist --> withdrawn
    applied --> withdrawn
    screening --> withdrawn
    interviewing --> withdrawn
    offer --> withdrawn : offer declined
    accepted --> [*]
    rejected --> [*]
    withdrawn --> [*]
```

An invalid move returns `409` with the statuses that *are* allowed, and every response
includes `next_statuses` so a client only offers valid options. The rules are tested
for all 64 `(from, to)` pairs.

More detail is in the **[design doc](docs/design.md)**.

---

## API

Interactive docs (Swagger UI) are at `/docs` when the app is running. All data routes
need `Authorization: Bearer <token>`, and other users' resources return `404`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe and version |
| `GET` | `/ready` | Readiness probe: checks the database, `503` if it's down |
| `POST` | `/api/v1/auth/register` | Create an account and email a verification link |
| `POST` | `/api/v1/auth/verify-email` | Confirm the email with the token from the link |
| `POST` | `/api/v1/auth/verify-email/resend` | Send a new verification link (limited per hour) |
| `POST` | `/api/v1/auth/forgot-password` | Email a password reset link (always `202`) |
| `POST` | `/api/v1/auth/reset-password` | Set a new password with the link's token; signs out everywhere |
| `POST` | `/api/v1/auth/login` | Get an access token and a refresh token (OAuth2 password form) |
| `POST` | `/api/v1/auth/google` | Sign in with a Google ID token; links or creates the account |
| `POST` | `/api/v1/auth/refresh` | Swap a refresh token for a new pair (single use) |
| `POST` | `/api/v1/auth/logout` | Revoke a refresh token |
| `GET` | `/api/v1/users/me` | The current user |
| `PATCH` | `/api/v1/users/me` | Change email language, timezone, or reminder emails on/off |
| `GET` | `/api/v1/users/me/export` | Download all your data as JSON |
| `DELETE` | `/api/v1/users/me` | Delete your account and all its data (needs your password, or Google) |
| `GET` | `/api/v1/applications` | List: `status`, `source`, `company`, `sort`, `limit`, `offset` |
| `POST` | `/api/v1/applications` | Create |
| `GET` `PATCH` `DELETE` | `/api/v1/applications/{id}` | Read, partially update, delete |
| `POST` | `/api/v1/applications/{id}/status` | Move to a new status (validated) |
| `GET` | `/api/v1/applications/{id}/history` | Every status change, oldest first |
| `GET` `POST` | `/api/v1/applications/{id}/interviews` | List, add interviews |
| `GET` `PATCH` `DELETE` | `/api/v1/applications/{id}/interviews/{iid}` | One interview |
| `GET` | `/api/v1/applications/export.csv` | Download as CSV (same filters as the list) |
| `GET` | `/api/v1/reminders/due` | Follow-ups due: `tz`, `within_days` |
| `GET` | `/api/v1/stats` | Funnel, rates, by-source results, days in stage |

<details>
<summary><b>Example session</b></summary>

```bash
# Register and log in
curl -X POST localhost:8000/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"email": "ada@example.com", "password": "correct-horse"}'
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -d 'username=ada@example.com&password=correct-horse' | jq -r .access_token)
AUTH="Authorization: Bearer $TOKEN"

# Add an application and move it forward
ID=$(curl -s -X POST localhost:8000/api/v1/applications -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"company": "Acme", "role_title": "Backend Engineer", "source": "referral", "follow_up_on": "2026-10-24"}' \
  | jq -r .id)
curl -X POST localhost:8000/api/v1/applications/$ID/status -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"status": "screening", "note": "Recruiter call booked"}'

# What's due, and how is it going?
curl "localhost:8000/api/v1/reminders/due?tz=Africa/Cairo" -H "$AUTH"
curl localhost:8000/api/v1/stats -H "$AUTH"
```

</details>

**Errors** always have the same shape, including a `request_id` that's also in the
server logs:

```json
{
  "error": {
    "code": "invalid_transition",
    "message": "Cannot move from wishlist to offer. Allowed: applied, withdrawn",
    "details": [{ "from": "wishlist", "to": "offer", "allowed": ["applied", "withdrawn"] }],
    "request_id": "3c729026ad4a49b2894e1b3d128aabd6"
  }
}
```

---

## Engineering highlights

The problems worth talking about, and how each was solved. Each one has tests, and most
link to the PR or ADR with the reasoning.

**Correctness**
- **Race-free status changes.** A status change locks the row (`SELECT … FOR UPDATE`).
  A PostgreSQL test fires two simultaneous changes and checks that exactly one wins;
  it fails 3 out of 3 times with the lock removed. ([#24](https://github.com/zeiado/applytrack/pull/24))
- **Timezones handled explicitly.** Interview times must include a timezone and are
  stored in UTC. "Due today" is computed in the caller's timezone, and the current
  time is an injected dependency, so tests freeze it without mocking. ([#25](https://github.com/zeiado/applytrack/pull/25), [#26](https://github.com/zeiado/applytrack/pull/26))
- **Same behaviour on SQLite and PostgreSQL.** A custom column type keeps timestamps
  UTC-aware on both, and SQLite foreign keys are switched on. Both gaps were found by
  tests. ([#21](https://github.com/zeiado/applytrack/pull/21), [#22](https://github.com/zeiado/applytrack/pull/22))
- **Stable pagination.** A deterministic sort with an `id` tie-breaker and nulls last,
  so paging never skips or repeats rows. ([#23](https://github.com/zeiado/applytrack/pull/23))

**Performance**
- **No N+1 queries.** Stats load everything in two queries. A test counts the SQL
  statements for 1 and 10 applications and requires exactly 3 either way. ([#27](https://github.com/zeiado/applytrack/pull/27))
- **Streaming export.** Rows are read in batches of 500 through a server-side cursor,
  so memory stays flat, and the export opens its own DB session because the response
  outlives the request's. ([#28](https://github.com/zeiado/applytrack/pull/28))
- **Indexes match the queries.** Composite indexes are created before the old ones are
  dropped, so a migration never leaves a column unindexed. ([#23](https://github.com/zeiado/applytrack/pull/23), [#26](https://github.com/zeiado/applytrack/pull/26))

**Security**
- **Ownership by construction.** Repositories only have user-scoped queries, and
  another user's resources return `404`, not `403`, so their existence isn't leaked.
- **Brute-force protection.** A sliding-window limit per (IP, email) and per IP is
  checked *before* the Argon2 hash, so blocked attempts cost no CPU. It blocks
  attempts rather than locking accounts, so it can't be used to lock someone out.
  ([ADR 0005](docs/adr/0005-in-memory-login-rate-limiting.md))
- **Injection defences beyond SQL.** CSV formula injection is escaped. Incoming
  request ids are validated so they can't forge log lines. Login timing is the same
  for unknown emails and wrong passwords. ([#28](https://github.com/zeiado/applytrack/pull/28), [#30](https://github.com/zeiado/applytrack/pull/30), [#21](https://github.com/zeiado/applytrack/pull/21))
- **Emails that match the data.** An email job is saved in the same transaction as the
  change that caused it, so a rolled-back sign-up never sends one. Workers claim jobs
  with `SKIP LOCKED`, retry temporary failures with backoff, and recover jobs from
  workers that died. ([ADR 0007](docs/adr/0007-database-job-queue-and-email.md))
- **Password reset that can't find or hijack accounts.** `forgot-password` answers the
  same for every email; links are one-time, hashed, expire in 30 minutes and travel in
  the URL fragment. A reset revokes refresh tokens and every access token issued before
  it. ([ADR 0008](docs/adr/0008-one-time-email-tokens.md))
- **Supply chain.** Actions are pinned to commit SHAs, and every locked dependency is
  audited. Released images carry provenance and an SBOM. Details are in [SECURITY.md](SECURITY.md).

**Process**
- **Guard rails instead of reminders.** Bugs that could come back are turned into tests:
  autogenerated migrations duplicating CHECK constraints, the Docker image running a
  Python version CI doesn't test, warnings slipping in (any warning fails the run).

---

## Quality and testing

| Check | Result |
|-------|--------|
| Automated tests | **328** (unit, API integration, migrations, concurrency) |
| Coverage | **100%** line and branch (CI fails below 85%) |
| Databases | Full suite on **PostgreSQL 17** in CI and in-memory **SQLite** locally |
| Python versions | **3.12** (minimum) and **3.14** (what Docker ships) |
| Static checks | Ruff (incl. bandit security rules), mypy `--strict`, actionlint for workflows |
| Migrations | Upgrade → `alembic check` (models match) → downgrade → upgrade, every run |
| Strictness | Any Python warning fails the test run |

Testing approach:

- **Unit tests** for the pure logic: workflow (all 64 transitions), stats (hand-checked
  numbers), rate limiter (fake clock), CSV escaping.
- **API tests** through FastAPI's `TestClient` for every endpoint, covering the success
  path, validation, ownership (`404` for other users) and authentication.
- **Fakes, not mocks:** the clock and the rate limiter's time source are injected, and
  the database is real.
- Fast: the full suite runs in about 13 seconds without coverage, because tests use
  cheap Argon2 settings and production keeps the secure ones (a test checks that).

## CI/CD

```mermaid
flowchart LR
    pr[Pull request] --> lint["Lint<br/><sub>ruff · actionlint</sub>"]
    pr --> types["mypy --strict"]
    pr --> tests["Tests on PostgreSQL<br/><sub>Python 3.12 + 3.14</sub>"]
    pr --> mig["Migrations<br/><sub>up · check · down</sub>"]
    pr --> audit["pip-audit"]
    pr --> sast["Semgrep"]
    tests --> docker["Docker build"]

    tag["git tag vX.Y.Z"] --> verify["Tag = pyproject version<br/>and changelog entry"]
    verify --> ci["Full CI"]
    ci --> ghcr["Push image to GHCR<br/><sub>SBOM + provenance</sub>"]
    ghcr --> release["GitHub Release<br/><sub>notes from CHANGELOG</sub>"]
```

- Every change goes through a PR with the [template](.github/pull_request_template.md),
  and CI must pass before merging.
- Dependabot opens weekly PRs for Python packages, Actions and the Docker base image.
- Releases are cut by pushing a tag. The steps are in
  [CONTRIBUTING.md › Releasing](CONTRIBUTING.md#releasing), and changes are in [CHANGELOG.md](CHANGELOG.md).

---

## Getting started

### Run with Docker

```bash
git clone https://github.com/zeiado/applytrack.git
cd applytrack
docker compose up --build
```

This starts PostgreSQL, applies migrations and serves the API at
**http://localhost:8000**, with interactive docs at **http://localhost:8000/docs**.
A `worker` service runs background jobs; with the default console backend, emails
appear in its log (`docker compose logs -f worker`).

Once a version is released, you can also pull the image:

```bash
docker pull ghcr.io/zeiado/applytrack:latest
```

### Local development

Requires [uv](https://docs.astral.sh/uv/) and Docker (for PostgreSQL).

```bash
uv sync                      # install dependencies from the lockfile
cp .env.example .env
make db                      # start PostgreSQL
make migrate                 # apply migrations
make run                     # API with auto-reload on :8000
make worker                  # in another terminal: background jobs; emails print here
```

| Command | What it does |
|---------|--------------|
| `make check` | Lint, type check and test: what CI runs |
| `make test` | Tests only (in-memory SQLite; no database needed) |
| `make audit` | Check dependencies for known vulnerabilities |
| `make migration m="add x"` | Autogenerate a migration (then review it) |
| `make format` | Auto-fix lint and formatting |
| `make test-email to=you@example.com` | Send one test email with the configured provider |

The web app is in [`web/`](web/README.md): `cd web && npm install && npm run dev`
(or `make web`) serves it on http://localhost:3000. After changing the API, run
`make openapi` to regenerate its typed client.

To run the tests against PostgreSQL like CI does:

```bash
APPLYTRACK_TEST_DATABASE_URL=postgresql+psycopg://applytrack:applytrack@localhost:5432/applytrack make test
```

## Configuration

All settings are environment variables (or a `.env` file). See [.env.example](.env.example).

| Variable | Default | Notes |
|----------|---------|-------|
| `APPLYTRACK_ENVIRONMENT` | `local` | `local`, `test` or `production` |
| `APPLYTRACK_DATABASE_URL` | local PostgreSQL | SQLAlchemy URL, e.g. `postgresql+psycopg://…` |
| `APPLYTRACK_JWT_SECRET_KEY` | dev-only value | **Required in production**: 32+ random characters, or the app won't start |
| `APPLYTRACK_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `APPLYTRACK_LOGIN_MAX_FAILURES_PER_ACCOUNT` | `5` | Failed logins per (IP, email) per window |
| `APPLYTRACK_LOGIN_MAX_FAILURES_PER_IP` | `20` | Failed logins per IP per window |
| `APPLYTRACK_LOGIN_WINDOW_SECONDS` | `60` | Rate-limit window |
| `APPLYTRACK_LOG_LEVEL` | `INFO` | |
| `APPLYTRACK_LOG_FORMAT` | `auto` | `auto` = JSON in production, text elsewhere |
| `APPLYTRACK_TRUSTED_PROXY_HOPS` | `0` | Proxies in front of the app that append to `X-Forwarded-For` ([docs/deployment.md](docs/deployment.md)) |
| `APPLYTRACK_APP_NAME` | `ApplyTrack` | Product name, used in API docs and emails |
| `APPLYTRACK_PUBLIC_APP_URL` | `http://localhost:3000` | The web app; links in emails point here |
| `APPLYTRACK_EMAIL_VERIFICATION_EXPIRE_HOURS` | `24` | Verification link lifetime |
| `APPLYTRACK_PASSWORD_RESET_EXPIRE_MINUTES` | `30` | Password reset link lifetime |
| `APPLYTRACK_FORGOT_PASSWORD_MAX_PER_IP` | `10` | Password reset requests per IP per hour |
| `APPLYTRACK_REMINDER_HOUR` | `8` | Local hour (in each user's timezone) from which reminder emails go out |
| `APPLYTRACK_REMINDER_CHECK_MINUTES` | `5` | How often the worker checks for users whose morning has come |
| `APPLYTRACK_EMAIL_TOKEN_LIMIT_PER_HOUR` | `3` | Emails of each kind (verification, reset) per account per hour |
| `APPLYTRACK_EMAIL_BACKEND` | `console` | `console` (log only), `resend` or `smtp` |
| `APPLYTRACK_EMAIL_FROM` | `ApplyTrack <noreply@localhost>` | Sender; must be on your verified domain for `resend`/`smtp` |
| `APPLYTRACK_EMAIL_REPLY_TO` | unset | Optional `Reply-To` |
| `APPLYTRACK_RESEND_API_KEY` | unset | Required for `resend` |
| `APPLYTRACK_SMTP_HOST` / `_PORT` / `_USERNAME` / `_PASSWORD` | unset / `587` | The host is required for `smtp` |
| `APPLYTRACK_SMTP_SECURITY` | `starttls` | `starttls`, `tls` (implicit, usually port 465) or `none` (refused in production) |
| `APPLYTRACK_RUN_WORKER_IN_API` | `false` | Run the job worker inside the API process (for hosts without worker services) |
| `APPLYTRACK_WORKER_POLL_SECONDS` | `2` | How often an idle worker checks for jobs |
| `APPLYTRACK_JOB_MAX_ATTEMPTS` | `5` | Attempts before a job is marked failed |

---

## Project structure

```
src/applytrack/
├── api/
│   ├── routes/        # one module per resource; thin HTTP layer
│   ├── deps.py        # DB session, current user, clock
│   └── router.py      # mounts everything under /api/v1
├── services/          # business rules (workflow, stats, reminders, export are pure)
├── repositories/      # all SQL, always scoped to a user
├── schemas/           # Pydantic request/response models: the API contract
├── models/            # SQLAlchemy tables and enums
├── core/              # settings, security, errors, logging, middleware, rate limiting
├── db/                # engine and per-request sessions
├── jobs/              # job queue in PostgreSQL and the worker loop
├── mail/              # email backends and Arabic/English templates
├── main.py            # app factory
└── worker.py          # worker process: python -m applytrack.worker
migrations/            # Alembic migrations (reviewed by hand, tested in CI)
tests/                 # ~2,900 lines of tests for ~2,400 lines of app code
docs/
├── requirements.md    # user stories (MoSCoW), functional and non-functional requirements
├── design.md          # architecture, data model, API conventions, trade-offs
├── adr/               # architecture decision records
└── backlog.md         # milestones and issues
scripts/               # container entrypoint, changelog extraction
```

## How this project was built

It follows a full software development lifecycle, and every stage left something
you can read:

| Stage | Artifact |
|-------|----------|
| **Requirements** | [docs/requirements.md](docs/requirements.md): problem, user stories with MoSCoW priorities, non-functional requirements |
| **Design** | [docs/design.md](docs/design.md) and six [ADRs](docs/adr/) recording each major decision with its alternatives |
| **Planning** | [GitHub issues](https://github.com/zeiado/applytrack/issues?q=is%3Aissue) with acceptance criteria, grouped into [milestones](https://github.com/zeiado/applytrack/milestones) |
| **Implementation** | One branch and PR per issue, [Conventional Commits](https://www.conventionalcommits.org/), each commit passing tests on its own ([CONTRIBUTING.md](CONTRIBUTING.md)) |
| **Review** | [Pull requests](https://github.com/zeiado/applytrack/pulls?q=is%3Apr) that explain what, why, design notes and how to test |
| **Testing** | A test for every acceptance criterion, plus a guard test for every bug class that could come back |
| **Release** | Semantic Versioning, [CHANGELOG.md](CHANGELOG.md), tag-driven releases |
| **Maintenance** | Dependabot, weekly Semgrep scan, [SECURITY.md](SECURITY.md) |

### Architecture decision records

| # | Decision |
|---|----------|
| [0001](docs/adr/0001-record-architecture-decisions.md) | Record architecture decisions |
| [0002](docs/adr/0002-fastapi-postgres-sqlalchemy.md) | FastAPI, PostgreSQL and SQLAlchemy 2.0 |
| [0003](docs/adr/0003-jwt-authentication.md) | Stateless JWT access tokens |
| [0004](docs/adr/0004-store-enums-as-strings.md) | Store enums as strings with CHECK constraints |
| [0005](docs/adr/0005-in-memory-login-rate-limiting.md) | In-memory rate limiting for failed logins |
| [0006](docs/adr/0006-rotating-refresh-tokens.md) | Rotating refresh tokens with reuse detection |
| [0007](docs/adr/0007-database-job-queue-and-email.md) | A job queue in PostgreSQL, and pluggable email backends |
| [0008](docs/adr/0008-one-time-email-tokens.md) | One-time tokens for email links |
| [0009](docs/adr/0009-sign-in-with-google.md) | Sign in with Google |
| [0010](docs/adr/0010-web-app.md) | The web app: Next.js in this repo, tokens kept on the server |

## Roadmap

- [x] Staging and production deployments on Render + Neon ([docs/deployment.md](docs/deployment.md))
- [x] Refresh tokens, so sessions outlive the 30-minute access token ([ADR 0006](docs/adr/0006-rotating-refresh-tokens.md))
- [x] Background jobs and email in Arabic and English ([ADR 0007](docs/adr/0007-database-job-queue-and-email.md))
- [x] Email verification ([ADR 0008](docs/adr/0008-one-time-email-tokens.md))
- [x] Password reset by email ([ADR 0008](docs/adr/0008-one-time-email-tokens.md))
- [x] Sign in with Google ([ADR 0009](docs/adr/0009-sign-in-with-google.md))
- [x] Daily follow-up reminder emails
- [ ] Web app in Arabic and English ([milestone v1.2](https://github.com/zeiado/applytrack/milestone/6)): sign-in, the applications board, application pages and settings are done ([ADR 0010](docs/adr/0010-web-app.md))
- [ ] Chrome extension to save jobs from LinkedIn, Wuzzuf, Bayt and Forasna
- [ ] Redis-backed rate limiter for multi-instance deployments (the interface is ready; see ADR 0005)
- [ ] Keyset pagination if lists grow large
- [ ] Container image scanning with a verified Trivy binary

## License

© 2026 Zeyad Gamal. All rights reserved. The code is public to read, not to reuse: see [LICENSE](LICENSE). Versions published before this change remain under the MIT License.
