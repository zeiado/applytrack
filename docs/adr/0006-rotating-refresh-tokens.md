# 6. Rotating refresh tokens

- Status: Accepted
- Date: 2026-10-20

## Context

Access tokens last 30 minutes and can't be revoked (ADR 0003). A web app and a
browser extension need sessions that last days without asking for the password
again, and users need a way to log out.

## Decision

- Login returns a 30-minute JWT access token **and** a refresh token.
- Refresh tokens are **opaque random strings** (256 bits), not JWTs, so the server
  can revoke them. Only a SHA-256 hash is stored in `refresh_tokens`; a fast hash is
  enough because the token is random, not a guessable password.
- **Rotation:** `POST /auth/refresh` revokes the token it receives and returns a new
  pair. Tokens from one login share a `family_id`.
- **Reuse detection:** a revoked token sent again means two parties hold it (for
  example, a stolen token). The server revokes every refresh token of that user and
  returns `401 refresh_token_reused`; the user logs in again with their password.
- **Grace period (added for the web app, #64):** a token used again within 30 seconds
  of being rotated (`APPLYTRACK_REFRESH_REUSE_GRACE_SECONDS`, 0 turns it off) gets a
  new pair in the same family instead of counting as reuse, as long as the session is
  still active (not logged out or revoked). The web app's server refreshes for the
  browser, and two page loads at the moment the access token expires would otherwise
  sign the user out everywhere. `rotated_at` tells rotation apart from logout, which
  gets no grace.
- `POST /auth/logout` revokes one token and always returns `204`.
- The token row is locked (`SELECT ... FOR UPDATE`) during a refresh, so two
  simultaneous refreshes with one token can't both succeed.
- Refresh tokens expire after 30 days (`APPLYTRACK_REFRESH_TOKEN_EXPIRE_DAYS`).

## Alternatives considered

- **Long-lived access tokens**: simple, but a leaked token works until it expires.
- **JWT refresh tokens**: still need a database row to revoke, so no real gain.
- **Server-side sessions with cookies**: a good fit for the web app later, but the
  Chrome extension and other clients need bearer tokens either way.

## Consequences

- Clients must store the newest refresh token after every refresh. Refreshes with the
  same token within the grace period both succeed; after it, a second use is reuse.
- Someone who steals a refresh token and uses it within 30 seconds of the user's own
  refresh gets a session without triggering reuse detection. That window is short, and
  the stolen token stops working at its next use after the user's next refresh.
- Sending a logged-out token again also counts as reuse.
- Expired and revoked rows build up; a periodic cleanup job can delete rows past
  `expires_at` once the background worker exists.
- The web app may later keep the refresh token in an `HttpOnly` cookie instead of
  JavaScript-readable storage.
