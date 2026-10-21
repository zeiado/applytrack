# 9. Sign in with Google

- Status: Accepted
- Date: 2026-10-21

## Context

Students should be able to start without making up a password (#46). ApplyTrack is an
API used by a web app and a Chrome extension, so the API doesn't render a login page or
handle browser redirects. Google sign-in must return the same tokens as password login
(ADR 0003, ADR 0006), link to an existing account with the same email, and must not let
anyone take over an account.

## Decision

- **ID token flow.** The client shows Google's sign-in button (Google Identity Services
  on the web; `chrome.identity` in the extension) and sends the ID token it gets to
  `POST /auth/google`. The API needs no client secret and no redirect URI, and the
  OAuth code exchange stays out of our code.
- **Checking the token** (`core/google.py`): the signature must verify with one of
  Google's published RS256 keys (fetched from `https://www.googleapis.com/oauth2/v3/certs`
  with `jwt.PyJWKClient`, cached for an hour and refetched when a token names an unknown
  key). Only RS256 is accepted, whatever the token's header says. `aud` must be one of
  `APPLYTRACK_GOOGLE_CLIENT_IDS`, `iss` must be Google, and `exp` is checked with 60 s of
  clock skew. If Google's keys can't be fetched, the API answers `503 google_unavailable`.
- **Accounts are matched by Google's `sub`**, stored in `users.google_subject` (unique).
  The email is only used the first time, to find an existing account; after that a
  changed Google email doesn't matter.
- **Linking by email requires `email_verified` from Google**, otherwise `403
  google_email_not_verified`. A user can link one Google account; another one with the
  same email gets `409 google_account_mismatch`.
- **Linking to an account whose email we haven't verified removes its password** and
  revokes its sessions (refresh tokens, and access tokens through `password_changed_at`).
  Anyone can register with an address they don't own. Without this, someone who
  registered with a student's address before the student signed in with Google would
  keep a working password for the student's account ("pre-account takeover"). A real
  owner who lost their password this way sets a new one with the forgot-password email.
- **Accounts created with Google have no password** (`password_hash` is nullable). Password
  login fails for them like a wrong password. They set one with the forgot-password
  email, which proves control of the inbox; there's no endpoint that sets a password with
  just an access token, so a stolen access token can't add a permanent way in.
  `GET /users/me` lists `sign_in_methods`, so the app knows when to offer this.
- **Deleting an account without a password** is confirmed with a new Google ID token for
  the linked account instead of the password.
- **Invalid tokens are rate limited per IP**, with the same limit and window as failed
  password logins (ADR 0005).
- **No nonce yet.** An ID token is only accepted for our client IDs and expires within an
  hour; it's as sensitive as a password and only sent over HTTPS. A nonce bound to the
  browser session can be added when the web app exists.

## Consequences

- Google sign-in is off until `APPLYTRACK_GOOGLE_CLIENT_IDS` is set (`503
  google_sign_in_not_configured`). The web app and the extension can use one Web client
  ID, or one each (comma-separated).
- The API calls Google only to refresh its key cache, about once an hour.
- A Google-only user who loses access to their Google account can still get in with a
  password reset email.
- Other providers (Microsoft for universities, Apple) would need a table of linked
  accounts instead of one column. That's a small migration when it's needed.
