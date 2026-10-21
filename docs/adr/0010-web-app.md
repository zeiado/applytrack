# 10. The web app: Next.js in the same repository, tokens kept on the server

- Status: Accepted
- Date: 2026-10-21

## Context

Phase 1 adds the product people use: a web app for students in Egypt, in Arabic and
English, that works well on phones (#63). It talks to the existing API. One part-time
developer builds it, so it should share as much as possible with the API: one
repository, one CI, one contract.

## Decision

- **Next.js (App Router) + TypeScript** in `web/`, in this repository. A change to the
  API and the screens that use it can land in one PR, and CI checks both together.
- **Arabic first, with right-to-left layout.** next-intl puts the language in the URL
  (`/ar`, `/en`); visitors without one get their browser's language, else Arabic.
  `<html lang dir>` is set per language, and components use logical CSS (start/end,
  not left/right), so one layout serves both directions. Messages live in
  `web/messages/{ar,en}.json`; a test fails if a key is missing from either language.
- **UI kit:** Tailwind CSS and shadcn/ui (Base UI), with RTL turned on. One typeface,
  IBM Plex Sans Arabic, covers both scripts. The brand color is one CSS variable and
  the product name one setting (`NEXT_PUBLIC_APP_NAME`), so a rebrand is small.
- **A typed API client generated from the API's OpenAPI schema** (openapi-typescript +
  openapi-fetch). `web/openapi.json` is exported from the API and committed; CI
  regenerates it and fails if the committed copy or the generated types are stale, so
  a breaking API change shows up as a type error in the web app.
- **The browser never holds a token.** Pages call the API from the Next.js server, which
  keeps the access and refresh tokens in httpOnly, Secure, SameSite cookies (built in
  #64). Script injected into a page (XSS) can't read them, and the API needs no CORS
  for the web app. The API client is marked `server-only`, so importing it into
  browser code fails the build.
- **Hosting: Vercel** (free Hobby plan to start), deploying `web/` from `main`, with a
  preview for every PR. The API stays on Render.
- **Next.js 16 defaults are kept:** Turbopack and Cache Components (partial
  prerendering). The marketing pages are prerendered per language.

## Consequences

- Two languages in one CI run: Python (API) and Node (web). The web job runs in
  parallel, so CI isn't slower.
- Each page that needs the user's data renders on the server; that's one extra hop
  (browser → Next.js → API) per request. Both are in the EU region (Vercel `fra1`,
  Render Frankfurt) to keep it short.
- A different frontend later (the Chrome extension, a mobile app) talks to the API
  directly with bearer tokens; the API stays the source of truth.
