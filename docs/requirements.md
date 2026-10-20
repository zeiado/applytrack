# Requirements

## Problem

Job seekers apply to dozens of roles at once. Applications live in spreadsheets,
email threads and memory. People forget to follow up, lose track of interview
dates, and can't tell which channels (referrals, job boards, cold outreach)
actually lead to offers.

ApplyTrack is a REST API that keeps every application, its status history and
its interviews in one place, and reminds the user when to follow up.

## Users

- **Job seeker**: the only role for v1. Each user sees only their own data.

## User stories

Priority uses MoSCoW: **M**ust, **S**hould, **C**ould, **W**on't (for v1).

| ID | As a job seeker, I want to... | So that... | Priority |
|----|-------------------------------|------------|----------|
| US-01 | register and log in | my data is private to me | M |
| US-02 | add an application (company, role, link, source, salary range, notes) | I have one record per application | M |
| US-03 | list my applications with filters (status, company, source) and pagination | I can find things quickly | M |
| US-04 | update or delete an application | the data stays accurate | M |
| US-05 | move an application through stages (applied → screening → interview → offer / rejected / withdrawn) | I know where each one stands | M |
| US-06 | see the full status history of an application | I can see how long each stage took | S |
| US-07 | log interviews (date, type, interviewer, notes) | I can prepare and look back | S |
| US-08 | set a follow-up date and get reminded when it's due | I never forget to follow up | S |
| US-09 | see stats (response rate, offers by source, average days per stage) | I learn which strategies work | C |
| US-10 | export my applications as CSV | I can use them elsewhere | C |
| US-11 | share a board with a mentor | they can give feedback | W |
| US-12 | download all my data and delete my account | I control my personal data (Egypt PDPL 151/2020) | M |

## Functional requirements

- FR-1: Passwords are hashed; auth uses short-lived JWT access tokens.
- FR-2: Every application, interview and status change belongs to exactly one user.
  A user can never read or change another user's data (requests for it return `404`).
- FR-3: Status changes follow an allowed-transitions table (see design doc).
  Invalid transitions return `409 Conflict`.
- FR-4: Every status change is recorded with a timestamp.
- FR-5: List endpoints are paginated (default 20, max 100) and sortable.
- FR-6: Errors use one consistent JSON shape.

## Non-functional requirements

| Area | Requirement |
|------|-------------|
| Performance | p95 latency under 200 ms for CRUD endpoints at low load |
| Security | OWASP API Top 10 basics: authn on all data routes, object-level authz, rate-limited login, no secrets in the repo |
| Reliability | Health and readiness endpoints; schema changes go through migrations |
| Quality | CI gate: lint, type check, tests, coverage at least 85% |
| Maintainability | Layered architecture, typed code, documented decisions (ADRs) |
| Portability | Runs anywhere with Docker; config via environment variables |

## Out of scope for v1

- Frontend UI (the API is documented through OpenAPI / Swagger UI)
- Email parsing or job-board scraping
- Multi-user sharing and teams
