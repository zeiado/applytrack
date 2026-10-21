# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/): a major version for breaking API
changes, a minor version for new features, and a patch version for fixes.

## [Unreleased]

### Added

- Daily follow-up reminder emails: one email on mornings when follow-ups are due, at 08:00 in the user's timezone, never twice a day, only to verified emails ([#45])
- `PATCH /users/me` to change the email language, timezone (default `Africa/Cairo`) and turn reminder emails off ([#45])
- A scheduled workflow wakes production each morning so reminders go out on Render's free plan ([#45])

## [0.3.0] - 2026-10-21

Email: background jobs, email verification and password reset.

### Added

- Background jobs stored in PostgreSQL, with retries and a worker (`python -m applytrack.worker`, or inside the API with `APPLYTRACK_RUN_WORKER_IN_API`) ([#42], [ADR 0007](docs/adr/0007-database-job-queue-and-email.md))
- Email through a console, Resend or SMTP backend chosen by `APPLYTRACK_EMAIL_BACKEND`, with templates in Arabic and English ([#42])
- Expired refresh tokens and old finished jobs are deleted hourly ([#42])
- Email verification: registering emails a one-time link (`POST /auth/verify-email`), which can be resent a few times per hour (`POST /auth/verify-email/resend`); `GET /users/me` shows `email_verified` ([#43], [ADR 0008](docs/adr/0008-one-time-email-tokens.md))
- `locale` (`ar` or `en`) at registration picks the language of emails ([#43])
- Password reset by email: `POST /auth/forgot-password` (always `202`, limited per account and per IP) and `POST /auth/reset-password`, which signs the user out everywhere and emails a security notice ([#44])

### Changed

- Access tokens carry a fractional `iat`, and tokens issued before a password reset are refused with `401 token_revoked` ([#44])

## [0.2.0] - 2026-10-21

First release.

### Added

- Download all your data (`GET /users/me/export`) and delete your account (`DELETE /users/me`) ([#40])
- Staging and production on Render with Neon PostgreSQL; tagged releases deploy to production ([#17], [docs/deployment.md](docs/deployment.md))
- Refresh tokens with rotation, `/auth/refresh` and `/auth/logout` ([#39])
- Applications: create, read, update and delete, scoped to the logged-in user ([#22])
- Listing with filters (status, source, company), sorting and pagination ([#23])
- Status workflow with validated transitions, `next_statuses` and full history ([#24])
- Interview log per application ([#25])
- Follow-up reminders that respect the caller's timezone ([#26])
- Stats: funnel, response/interview/offer rates, results by source, days in stage ([#27])
- CSV export, streamed in batches ([#28])
- Register, log in and `/users/me` with Argon2 password hashing and JWT ([#21])
- `/health` and `/ready` probes, PostgreSQL with Alembic migrations ([#1], [#20])
- One JSON error format with `request_id`; request ids and structured JSON logs ([#20], [#30])
- Release workflow: tagged versions publish a Docker image to GHCR and a GitHub Release

### Security

- Login rate limits and access logs use the real client IP behind a reverse proxy (`APPLYTRACK_TRUSTED_PROXY_HOPS`), ignoring forged `X-Forwarded-For` entries ([#50])
- Semgrep security scan on every PR and weekly, replacing CodeQL, whose results can't be uploaded from a private repo without paid GitHub Code Security
- Reusing a revoked refresh token signs the user out of every session ([#39])
- Failed-login rate limiting per (IP, email) and per IP ([#29])
- CSV export escapes cells that spreadsheets would run as formulas ([#28])
- Incoming request ids are validated to prevent log injection ([#30])
- Dependency audit and CodeQL in CI, Dependabot, actions pinned to commit SHAs ([#31])

### Fixed

- Timestamps are always timezone-aware UTC, on SQLite as well as PostgreSQL ([#21])
- Foreign keys and cascades are enforced on SQLite too ([#22])
- Interview times are returned in UTC on create, matching reads ([#25])
- CI tests the Python version the Docker image ships ([#35])

[Unreleased]: https://github.com/zeiado/applytrack/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/zeiado/applytrack/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/zeiado/applytrack/releases/tag/v0.2.0
[#1]: https://github.com/zeiado/applytrack/pull/1
[#20]: https://github.com/zeiado/applytrack/pull/20
[#21]: https://github.com/zeiado/applytrack/pull/21
[#22]: https://github.com/zeiado/applytrack/pull/22
[#23]: https://github.com/zeiado/applytrack/pull/23
[#24]: https://github.com/zeiado/applytrack/pull/24
[#25]: https://github.com/zeiado/applytrack/pull/25
[#26]: https://github.com/zeiado/applytrack/pull/26
[#27]: https://github.com/zeiado/applytrack/pull/27
[#28]: https://github.com/zeiado/applytrack/pull/28
[#29]: https://github.com/zeiado/applytrack/pull/29
[#30]: https://github.com/zeiado/applytrack/pull/30
[#31]: https://github.com/zeiado/applytrack/pull/31
[#35]: https://github.com/zeiado/applytrack/pull/35
[#17]: https://github.com/zeiado/applytrack/issues/17
[#39]: https://github.com/zeiado/applytrack/issues/39
[#40]: https://github.com/zeiado/applytrack/issues/40
[#42]: https://github.com/zeiado/applytrack/issues/42
[#43]: https://github.com/zeiado/applytrack/issues/43
[#44]: https://github.com/zeiado/applytrack/issues/44
[#45]: https://github.com/zeiado/applytrack/issues/45
[#50]: https://github.com/zeiado/applytrack/issues/50
