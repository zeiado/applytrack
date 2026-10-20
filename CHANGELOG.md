# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/): a major version for breaking API
changes, a minor version for new features, and a patch version for fixes.

## [Unreleased]

### Added

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

[Unreleased]: https://github.com/zeiado/applytrack/commits/main
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
[#39]: https://github.com/zeiado/applytrack/issues/39
