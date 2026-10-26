# Privacy notes

What personal data the app sends to other services, and why. Keep this up to date when
adding a service; the public privacy policy is written from it. Egypt's Personal Data
Protection Law (151/2020) applies, and users can already download or delete all their
data ([design](design.md)).

## Services that receive data

| Service | What for | What it receives | Off when |
|---|---|---|---|
| Neon (Postgres) | The database | Everything the app stores | Never |
| Render | Hosts the API and the worker | Requests and logs (log lines mask email addresses) | Never |
| Vercel | Hosts the web app | Requests, the visitor's IP (for rate limits) | Never |
| Cloudflare R2 | Stores uploaded CVs (#115, [ADR 0011](adr/0011-object-storage-for-cvs.md)) | The CV files, in a private bucket | `APPLYTRACK_STORAGE_*` unset (uploads off) |
| Resend or an SMTP provider | Sends emails | The address, the email's content | `APPLYTRACK_EMAIL_BACKEND=console` |
| Google | Sign in with Google | Only what Google already has; the app receives the email and Google account id | `APPLYTRACK_GOOGLE_CLIENT_IDS` unset |
| PostHog (EU) | Product analytics (#70) | Account id and the events below | `APPLYTRACK_POSTHOG_API_KEY` unset |
| Sekka browser extension | Saves a job from the page the user is on (#69) | The company, role and link of that page, when the user clicks Save | Not installed |
| Sentry | Error reports (#70) | Error details with personal data removed | `APPLYTRACK_SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` unset |

## Product analytics (PostHog)

Events are sent **from the API**, not the browser, so the browser runs no tracking
script and stores no cookie for it. That's why there's no cookie banner.

- **Who:** the account's random id (a UUID). Never the email or name.
- **Where from:** PostHog's GeoIP lookup is off, and the IP it sees is the API server's,
  not the user's.
- **Events:** `signed_up` (`method`: password or google, `locale`), `application_created`
  (`status`, `source`, `first`), and `active` (at most once a day, for active-user counts).
  Nothing the user types (companies, roles, notes) is sent.
- **Host:** `https://eu.i.posthog.com` (EU cloud) by default.

Code: `src/applytrack/core/analytics.py`.

## Error reports (Sentry)

The API, the worker and the web app (server and browser) report unexpected errors.
Before an event leaves, these are removed:

- the user, IP address, cookies, request headers (except `Accept`, `Content-Type`,
  `User-Agent` and `X-Request-Id`) and request bodies;
- URL query strings and `#fragments`, where email links carry their tokens;
- email addresses in messages and error texts (replaced with `[email]`), and the `to`
  field of mail logs;
- breadcrumbs from the mail logger, which in console mode logs whole emails.

No session replay and no performance tracing. Code: `src/applytrack/core/observability.py`
and `web/src/lib/sentry.ts`.

## Browser extension

The extension (`extension/`) reads the open page only when the user clicks it
(`activeTab`), shows what it found, and sends it to the user's own Sekka account only
when they click Save. It has no access to other tabs or the browsing history, and keeps
nothing itself. The Chrome Web Store's privacy form asks for this; the answers are in
`extension/README.md`.

## Uploaded CVs

Users can upload up to 3 CVs (PDF or Word, 5 MB each). The file is kept in a private R2
bucket; the API reads its text on the job queue and keeps the text in the database, for
Sekka AI. Files are only reachable through signed links valid for a few minutes. The
data download includes each CV's details and text (not the file, which the user can
download from the profile page). Deleting a CV or the account deletes the files from the
bucket within minutes (retried for about four hours if R2 is down).

## Public privacy policy and terms

`/[locale]/privacy` and `/[locale]/terms` (text in `web/src/content/legal/`), written
from this file: when a service is added here, add it to the policy too and change its
date. The home page footer, sign-up and settings link to them. Before a wide launch, a
lawyer should review both, and the operator's legal name goes in once the company is
registered.

## Still to do before launch

- Data processing terms with each service above (PostHog, Sentry, Resend and Neon offer
  standard DPAs).
- If analytics ever moves into the browser (page views, session recordings), it needs a
  consent prompt first.
