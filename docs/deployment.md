# Deployment

- Staging: https://applytrack-staging-jxnw.onrender.com ([API docs](https://applytrack-staging-jxnw.onrender.com/docs))
- Production: https://applytrack-production-jxnw.onrender.com ([API docs](https://applytrack-production-jxnw.onrender.com/docs))

Two environments, both in Frankfurt (closest to Egypt that both providers offer):

| | Staging | Production |
|---|---|---|
| API | Render `applytrack-staging` (free plan) | Render `applytrack-production` (free plan) |
| Database | Neon project `applytrack`, branch `staging` | Same project, branch `main` |
| Deploys | Every commit on `main` once CI passes | Each tagged release (`vX.Y.Z`) |
| Config | [`render.yaml`](../render.yaml) | [`render.yaml`](../render.yaml) |

The container runs `alembic upgrade head` before starting (`scripts/start.sh`), so
migrations apply on every deploy. Render's health check is `/ready`, which also checks
the database.

## Free plan limits

- Render free web services sleep after 15 minutes without traffic; the next request
  takes about a minute while the service starts. Upgrade to a paid instance before real users rely on it.
- Neon free: 0.5 GB storage per project, compute scales to zero when idle
  (the first query after a pause takes a moment).
- Render's own free Postgres expires after 30 days, which is why the database is on Neon.

## How a release reaches production

1. Release as in [CONTRIBUTING.md › Releasing](../CONTRIBUTING.md#releasing).
2. After the image and GitHub Release are published, the **Release** workflow calls the
   production service's deploy hook with the tagged commit (`?ref=<sha>`).
3. It then polls `<PRODUCTION_URL>/health` until it reports the new version, and fails
   if that takes longer than 10 minutes.

Repository settings this needs (Settings › Secrets and variables › Actions):

| Name | Kind | Value |
|---|---|---|
| `RENDER_PRODUCTION_DEPLOY_HOOK` | Secret | Production service › Settings › Deploy Hook |
| `PRODUCTION_URL` | Variable | e.g. `https://applytrack-production.onrender.com` |

If the secret isn't set, the deploy job is skipped and the release still completes.

## Client IP behind Render's proxy

Render appends to `X-Forwarded-For` but keeps what the client sent, so the app trusts
only the last `APPLYTRACK_TRUSTED_PROXY_HOPS` entries (see `core/client_ip.py`). The value
is measured, not guessed:

1. On staging (log level `DEBUG`), send a request with a fake entry:
   `curl -H "X-Forwarded-For: 203.0.113.7" https://<staging>/health`
2. Find the `X-Forwarded-For has K entries` log line for it. Render's proxies added
   `K - 1` entries, so set `APPLYTRACK_TRUSTED_PROXY_HOPS` to `K - 1` on both services.
3. Check: the access log's `client` for a request without the fake header is your own
   public IP, and adding fake entries doesn't change it.

**Measured 2026-10-20:** normal requests arrive with 3 entries and a request with one
fake entry with 4, so Render adds 3 and `APPLYTRACK_TRUSTED_PROXY_HOPS=3`. Measure again
if requests start showing a different count, or after putting a CDN in front.

## Background jobs and email

Free Render instances can't run a separate worker, so both services set
`APPLYTRACK_RUN_WORKER_IN_API=true` and the API runs the job worker in a thread
([ADR 0007](adr/0007-database-job-queue-and-email.md)). Jobs are in the database, so
none are lost when a service sleeps or redeploys; they run when it's back.

Until there's a sending domain, `APPLYTRACK_EMAIL_BACKEND=console`: emails are written to
the service log (Render › service › Logs, search for `Email not sent`), and the API
logs a warning at startup. Links in those emails are visible to anyone with log access,
so switch to a provider before real users sign up.

**Switching to Resend** (no code change):

1. Buy the domain, add it in Resend › Domains, and add the DNS records it shows (SPF,
   DKIM; add a DMARC record too). Wait until Resend shows it verified.
2. Create an API key with "Sending access" for that domain only.
3. On each Render service › Environment, set `APPLYTRACK_EMAIL_BACKEND=resend`,
   `APPLYTRACK_RESEND_API_KEY` (paste it there, never in a chat or a file in the repo)
   and `APPLYTRACK_EMAIL_FROM`, e.g. `Sekka <noreply@mail.example.com>`. Send from a
   subdomain, so marketing email later can't hurt its reputation.
4. Locally, with the same values in `.env`: `make test-email to=you@example.com locale=ar`.

Any SMTP provider works the same way with `APPLYTRACK_EMAIL_BACKEND=smtp` and the
`APPLYTRACK_SMTP_*` settings. The app refuses to start if a provider's settings are
incomplete, so a typo shows up at deploy time, not on the first email.

**Reminder emails on the free plan.** The morning reminder check only runs while the
service is awake, and free services sleep after 15 minutes without traffic. The
**Wake production** workflow (`.github/workflows/wake-production.yml`) requests `/health`
at 05:05 and 06:05 UTC, which is just after 08:00 in Cairo in summer and in winter, so
the worker starts and sends that morning's emails. Users in other timezones get theirs
the next time the service is awake after their morning. A paid instance doesn't sleep;
delete the workflow then.

When a paid plan allows it, run `python -m applytrack.worker` as a Render background
worker and turn `APPLYTRACK_RUN_WORKER_IN_API` off.

## Web app on Vercel

The web app (`web/`, [ADR 0010](adr/0010-web-app.md)) deploys to Vercel. One-time setup:

1. Sign in to vercel.com with GitHub, then Add New › Project › import `zeiado/applytrack`
   (give Vercel access to this private repo when GitHub asks).
2. **Root Directory: `web`**. Vercel detects Next.js; keep the default build settings.
3. Environment variables: `API_URL` = the API's URL
   (`https://applytrack-production-jxnw.onrender.com` for Production,
   `https://applytrack-staging-jxnw.onrender.com` for Preview), and optionally
   `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL` (the address shown on the
   privacy and terms pages).
4. Settings › Functions › Region: Frankfurt (`fra1`), next to the API.
5. For Sign in with Google: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = the same client ID as the
   API's `APPLYTRACK_GOOGLE_CLIENT_IDS`. Without it, the Google button is hidden.
6. Deploy. Every push to `main` deploys production; every PR gets a preview URL.
   `NEXT_PUBLIC_*` values are built into the app, so redeploy after changing one.

**Visitor IPs.** The web app's server calls the API for its visitors, so without help
the API would see every request coming from Vercel and the per-IP rate limits would
apply to all users together. Set the same random value (32+ characters; Render's
"Generate" button makes one) as `APPLYTRACK_CLIENT_IP_SECRET` on each Render service
and as `API_PROXY_SECRET` in Vercel (Production for the production API, Preview for
staging). The web server then sends each visitor's IP in `X-Client-IP` with the secret
in `X-Proxy-Secret`; the API ignores `X-Client-IP` from anyone without the secret.

## Browser extension

The extension (`extension/`, #69) is built from this repo and published to the Chrome
Web Store by hand; the steps are in `extension/README.md`. Once it's published, set
`EXTENSION_IDS` in Vercel (Production) to its store id, so only our extension can use
the web app's `/api/extension/*` routes.

## Error tracking and analytics

Both are off until their keys are set (#70). Neither receives personal data; see the
[privacy notes](privacy.md).

1. **Sentry** (sentry.io, free plan, EU data region): create two projects, *Python /
   FastAPI* for the API and *Next.js* for the web app. Set the API project's DSN as
   `APPLYTRACK_SENTRY_DSN` on each Render service, and the web project's DSN as
   `NEXT_PUBLIC_SENTRY_DSN` in Vercel, then redeploy the web app (the value is built in).
   Each service reports its environment (`production`, `preview`), so one project can
   hold staging and production.
2. **PostHog** (posthog.com, free plan, **EU Cloud**): create a project and set its
   project API key (`phc_...`, not a secret) as `APPLYTRACK_POSTHOG_API_KEY` on the
   production Render service only, so staging doesn't count as real users. In the
   project settings, turn on "Discard client IP data".
   Useful insights: sign-ups per week (`signed_up`), activation (`signed_up` →
   `application_created` with `first = true` within 7 days), and weekly active users
   (unique users with `active`).

Then add the Vercel URL (and later the real domain) to the Google OAuth client's
"Authorized JavaScript origins", and set `APPLYTRACK_PUBLIC_APP_URL` on the API to it,
so links in emails open the web app.

## Sign in with Google

Off until `APPLYTRACK_GOOGLE_CLIENT_IDS` is set ([ADR 0009](adr/0009-sign-in-with-google.md)).

1. In Google Cloud Console, create a project, then Google Auth Platform › Branding: the
   app name, support email and (once there's a domain) the home page and privacy policy.
   Audience: External. Data access: the `openid`, `email` and `profile` scopes only, which
   don't need Google's verification review.
2. Clients › Create client › Web application. Add the web app's origins under
   "Authorized JavaScript origins" (`http://localhost:3000` for development, then the
   real domain). No redirect URI or client secret is needed.
3. On each Render service › Environment, set `APPLYTRACK_GOOGLE_CLIENT_IDS` to the client
   ID (`...apps.googleusercontent.com`). It isn't a secret; the web app uses it too.
   Several IDs are comma-separated, e.g. a separate one for staging or the extension.
4. Until the app is published in Google Auth Platform › Audience, only listed test users
   can sign in. Publish it before launch.

## Rollback

- **Code:** Render › service › Events › pick an earlier deploy › Rollback.
- **Database:** Neon keeps history, so a branch can be restored to a point in time
  (Neon console › Branches › Restore). Migrations should stay backward compatible with
  the previous release, so rolling back code doesn't need a database rollback.

## Secrets

- `APPLYTRACK_DATABASE_URL` is entered in Render when the Blueprint is created and never
  committed. Use the Neon connection string with the `postgresql+psycopg://` scheme.
- `APPLYTRACK_JWT_SECRET_KEY` is generated by Render, separately for each service.
