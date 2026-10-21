# 8. One-time tokens for email links

- Status: Accepted
- Date: 2026-10-21

## Context

Email verification (#43) and password reset (#44) send a link that proves the person
clicking it controls the email address. A password-reset link is as powerful as the
password, so it has to be hard to guess, short-lived and usable once. The endpoints
that send these emails must not be usable to flood someone's inbox, or (for password
reset) to find out which emails have accounts.

## Decision

- **Opaque random tokens**: 256 bits from `secrets.token_urlsafe(32)`, the same as
  refresh tokens (ADR 0006). Only the SHA-256 hash is stored, in `email_tokens`, with
  its `purpose` (`verify_email` or `reset_password`), `expires_at` and `used_at`. A
  JWT would need a database row to be single-use anyway.
- **Lifetimes**: verification links last 24 hours
  (`APPLYTRACK_EMAIL_VERIFICATION_EXPIRE_HOURS`), password-reset links 30 minutes
  (`APPLYTRACK_PASSWORD_RESET_EXPIRE_MINUTES`).
- **Single use**: using a token marks it used, along with every other unused token
  of the same purpose for that user, so older links stop working too. The row is locked
  (`SELECT ... FOR UPDATE`) while it's checked, so two simultaneous uses can't both
  succeed.
- **The token goes in the URL fragment**: `<APPLYTRACK_PUBLIC_APP_URL>/verify-email#token=...`.
  Browsers don't send the fragment to servers, so the token stays out of web server
  logs, analytics and `Referer` headers. The web app reads it and POSTs it to the API.
- **Rate limits come from the database**: at most `APPLYTRACK_EMAIL_TOKEN_LIMIT_PER_HOUR`
  (3) emails of each kind per account per hour, counted from `email_tokens.created_at`.
  The count survives restarts and works across API instances without Redis (#41).
  Rows are therefore kept after use; housekeeping deletes them a day after they expire.
- **Password reset doesn't reveal accounts**: `POST /auth/forgot-password` returns `202`
  whether or not the email exists, and whether or not the account's limit was reached.
  It is also limited per IP, in memory (ADR 0005), so one client can't try thousands of
  addresses.
- **A reset ends every session**: it revokes all refresh tokens (ADR 0006) and sets
  `users.password_changed_at`. Access tokens issued before that moment are refused, so
  a stolen 30-minute access token stops working too. The user is emailed that the
  password changed.
- **A reset also verifies the email**, since following the link proves the user
  controls the address.

## Alternatives considered

- **Signed, stateless tokens (JWT or `itsdangerous`)**: no table, but no way to make
  them single-use or to revoke them without one.
- **Short numeric codes** (e.g. 6 digits): easier to type on a phone, but guessable,
  so they need strict attempt limits. Possible later for the mobile app.
- **Token in the query string**: simpler, but the token would be logged by every server
  and proxy the link passes through.
- **In-memory limits for emails per account**: they reset on every deploy, and on
  Render's free plan the service restarts often.

## Consequences

- `email_tokens` grows by one row per email sent and is pruned hourly.
- Existing users start unverified (`email_verified_at` is null).
- The web app must have `/verify-email` and `/reset-password` pages that read the
  fragment. Until it exists, the links show where the token is but lead nowhere.
- Changing an email address (not supported yet) will need its tokens to record the
  address they were sent to.
