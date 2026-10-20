# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them privately
through GitHub: **Security → Report a vulnerability** on this repository.
Include steps to reproduce and, if you have it, the `request_id` from an error
response.

You'll get a reply within 7 days. Fixes are released as a patch version and noted
in the changelog.

## Supported versions

Only the latest release gets security fixes.

## What's in place

| Area | Measure |
|------|---------|
| Passwords | Argon2id hashing; never logged or returned |
| Auth | Short-lived JWTs signed with a secret that production refuses to start without (ADR 0003); rotating refresh tokens stored as hashes, with reuse detection (ADR 0006) |
| Brute force | Failed-login rate limiting per (IP, email) and per IP (ADR 0005) |
| Data access | Every query scoped to the logged-in user; other users' data returns 404 |
| Data rights | Users can export all their data and delete their account; deletion needs the password and is rate limited |
| Input | Strict validation; unknown fields and query parameters rejected |
| Output | No internal details in 500 responses; CSV export escapes formula injection |
| Logs | Request ids validated against log injection; query strings not logged |
| Dependencies | `pip-audit` on every CI run and Dependabot weekly updates |
| Code | Ruff security rules (bandit) on every commit; Semgrep on every PR and weekly |
| CI | Actions pinned to commit SHAs; workflows get read-only permissions by default |
| Container | Runs as a non-root user |
