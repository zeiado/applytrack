# 5. In-memory rate limiting for failed logins

- Status: Accepted
- Date: 2026-10-17

## Context

Without a limit, anyone can guess passwords against `/auth/login` as fast as the
server answers. Each guess also costs an Argon2 hash (~60 ms of CPU), so a flood of
guesses is a cheap way to overload the server.

Two attacks matter:

1. **Brute force:** many passwords against one account.
2. **Credential stuffing:** leaked email/password pairs tried against many accounts
   from one machine.

## Decision

- Count **failed** logins in a sliding 60-second window, with two limits:
  - **5 per (IP, email)** pair: stops brute force on one account.
  - **20 per IP** across all emails: stops one machine trying many accounts.
- Check the limits **before** verifying the password, so blocked requests cost no hashing.
- Return `429 too_many_login_attempts` with `Retry-After` (seconds).
- A successful login resets the (IP, email) count only.
- Limits are settings (`APPLYTRACK_LOGIN_MAX_FAILURES_PER_ACCOUNT`, `..._PER_IP`,
  `APPLYTRACK_LOGIN_WINDOW_SECONDS`).
- Store the counts **in process memory** (`InMemoryRateLimiter`), behind a small
  `RateLimiter` protocol.

## Alternatives considered

- **Redis:** shared by every server process, survives restarts. It's the right
  choice for more than one instance, but it's another service to run and pay for,
  and this app runs as a single instance.
- **A database table of attempts:** shared without new infrastructure, but it adds
  writes to every failed login and needs cleanup jobs.
- **A library such as slowapi:** limits whole requests by route, but can't easily
  count only *failed* logins or reset on success.
- **Locking the account after N failures:** lets an attacker lock anyone out on
  purpose. A time-limited block per (IP, email) avoids that.

## Consequences

- Correct for **one** server process. With N processes or instances each keeps its own
  counts, so the effective limit becomes N × 5. Moving to Redis means writing a
  `RedisRateLimiter` that implements the same three methods; nothing else changes.
- Counts reset when the process restarts. That's acceptable for a 60-second window.
- **Client IP behind a proxy:** most hosts put a load balancer in front of the app,
  so `request.client.host` would be the proxy's address and everyone would share one
  limit. Uvicorn trusts `X-Forwarded-For` only from the addresses in
  `FORWARDED_ALLOW_IPS`; set it to the host's proxy range when deploying. Trusting it
  from everywhere would let clients forge their IP and dodge the limit.
- An attacker rotating through many IPs isn't stopped by these limits. That needs
  network-level protection (a WAF or the host's DDoS protection) and is out of scope.
