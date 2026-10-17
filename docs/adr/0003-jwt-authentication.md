# 3. Stateless JWT access tokens

- Status: Accepted
- Date: 2026-10-17

## Context

Every data endpoint needs an authenticated user. The API has no browser frontend
in v1, so cookie sessions are not a natural fit.

## Decision

- Passwords are hashed with **Argon2** (via `pwdlib`).
- Login returns a signed **JWT access token** (HS256, 30-minute expiry) holding
  the user id in `sub`.
- Routes get the current user through a FastAPI dependency that verifies the
  token and loads the user.
- Object-level authorization: every query is scoped by `user_id`. A resource
  owned by someone else returns `404`, so its existence isn't leaked.

## Alternatives considered

- **Server-side sessions**: easy to revoke, but need shared storage (Redis).
- **External identity provider (Auth0, Cognito)**: production-grade, but hides
  the auth flow that this project aims to show.

## Consequences

- Tokens can't be revoked before they expire; the short expiry limits the risk.
  Refresh tokens are a possible later addition.
- The signing secret comes from the environment and is never committed.
