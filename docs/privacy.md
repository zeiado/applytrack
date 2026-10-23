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
| Resend or an SMTP provider | Sends emails | The address, the email's content | `APPLYTRACK_EMAIL_BACKEND=console` |
| Google | Sign in with Google | Only what Google already has; the app receives the email and Google account id | `APPLYTRACK_GOOGLE_CLIENT_IDS` unset |
| PostHog (EU) | Product analytics (#70) | Account id and the events below | `APPLYTRACK_POSTHOG_API_KEY` unset |
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

## Still to do before launch

- A public privacy policy and terms, linked from sign-up and the home page.
- Data processing terms with each service above (PostHog, Sentry, Resend and Neon offer
  standard DPAs).
- If analytics ever moves into the browser (page views, session recordings), it needs a
  consent prompt first.
