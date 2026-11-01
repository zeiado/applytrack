# 14. Rate-limit counts in PostgreSQL

- Status: Accepted
- Date: 2026-11-01
- Changes: [ADR 0005](0005-in-memory-login-rate-limiting.md) (where the counts are kept)

## Context

ADR 0005 kept failed-login counts in process memory. Two problems follow on Render:

- **Every deploy resets them.** Each push to `main` starts a new process with empty
  counts, so an attacker loses nothing when we ship.
- **More than one process multiplies the limit.** With N workers or instances, each keeps
  its own counts, so 5 failures per account becomes 5 × N.

Issue #41 planned Redis for this. Redis is another service to run and pay for, and the
app doesn't need it yet: there is one PostgreSQL database every process already shares.

## Decision

- Add `DatabaseRateLimiter`, a second implementation of the `RateLimiter` protocol
  (`retry_after`, `hit`, `reset`), backed by a `rate_limit_events` table:
  `(limiter, key_hash, at)`, one row per counted event, indexed on all three.
- `retry_after` counts the key's rows inside the window and finds the oldest one, in one
  query. `hit` inserts a row. `reset` deletes the key's rows. Each call uses its own short
  session and commits at once, so a failure is counted even when the request then fails.
- **No raw keys are stored.** Keys hold emails and IP addresses; the table keeps their
  SHA-256, which is enough to tell keys apart.
- **Old rows are deleted** by the worker's hourly housekeeping, after a day (the longest
  window is an hour).
- All four limits use it: per (IP, email) and per IP for logins, forgot-password per IP,
  and invalid Google sign-ins per IP. Each has its own `limiter` name.
- `APPLYTRACK_RATE_LIMIT_STORE` picks `database` or `memory`. Unset, it's `database` in
  production and `memory` elsewhere, so tests and local development need nothing new.

## Alternatives considered

- **Redis (issue #41):** faster and built for this, but a new paid service for a load
  PostgreSQL handles easily. `RateLimiter` stays the seam if it's ever needed.
- **A counter row per key (fixed window):** fewer rows, but a fixed window lets twice the
  limit through around its edge, and it behaves differently from the in-memory limiter.
- **Keep it in memory:** the problems above.

## Consequences

- Counts survive deploys and are shared by every API process.
- Each failed login now writes one row, and each login does one indexed read. Failed
  logins are rare next to other requests, so this is cheap.
- Two requests at the same moment can both pass the check before either writes, so a
  burst can get one or two attempts past the limit. That's acceptable for a limit meant to
  slow guessing, not to count exactly.
- The table holds hashed IP/email keys for up to a day. A hash of an IP address can be
  reversed by trying every address, so the rows are treated as personal data and kept
  only that long.
