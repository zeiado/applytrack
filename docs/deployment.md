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

When a paid plan allows it, run `python -m applytrack.worker` as a Render background
worker and turn `APPLYTRACK_RUN_WORKER_IN_API` off.

## Rollback

- **Code:** Render › service › Events › pick an earlier deploy › Rollback.
- **Database:** Neon keeps history, so a branch can be restored to a point in time
  (Neon console › Branches › Restore). Migrations should stay backward compatible with
  the previous release, so rolling back code doesn't need a database rollback.

## Secrets

- `APPLYTRACK_DATABASE_URL` is entered in Render when the Blueprint is created and never
  committed. Use the Neon connection string with the `postgresql+psycopg://` scheme.
- `APPLYTRACK_JWT_SECRET_KEY` is generated by Render, separately for each service.
