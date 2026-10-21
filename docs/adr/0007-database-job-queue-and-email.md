# 7. A job queue in PostgreSQL, and pluggable email backends

- Status: Accepted
- Date: 2026-10-21

## Context

Email verification, password reset and reminder emails (#43, #44, #45) need email to
be sent without making the request wait for an email provider, and retried when the
provider is down. The backlog planned arq on Redis (#42).

Constraints:

- The app runs on Render's free plan, which has no background-worker services, and
  Redis would be another service to pay for and run.
- A sign-up must not end up with a user row but no verification email, or an email
  for a sign-up that was rolled back.
- The sending domain and the email provider aren't chosen yet (the brand isn't final).

## Decision

**Jobs are rows in a `jobs` table in the same PostgreSQL database.**

- `enqueue()` adds a job to the caller's session, so it commits or rolls back with
  the change that caused it (the transactional outbox pattern).
- A worker claims the oldest due job with `SELECT ... FOR UPDATE SKIP LOCKED`, marks it
  `running` with a 5-minute lease (`locked_until`) and commits. It runs the job
  outside any transaction, then marks it `done`, `failed`, or `pending` again for a retry.
- Retries back off exponentially: 30 s, 2 min, 8 min, 32 min, then hourly, up to
  `APPLYTRACK_JOB_MAX_ATTEMPTS` (5). A handler raises `PermanentJobError` when a
  retry can't help (a rejected address, an invalid payload), and the job fails at once.
- If a worker dies mid-job, its lease expires and another worker runs the job again.
  Jobs are therefore delivered **at least once**: handlers must tolerate a repeat. The
  email handler passes the job id as Resend's `Idempotency-Key`.
- Finished jobs have their payload cleared. Housekeeping deletes `done` jobs after
  7 days, `failed` jobs after 30, and expired refresh tokens (see ADR 0006).
- The worker runs as `python -m applytrack.worker` (a Compose service locally), or
  as a thread inside the API process with `APPLYTRACK_RUN_WORKER_IN_API=true`. Render
  uses the second, because the free plan has no workers. Several workers are safe at
  once.

**Email goes through one interface with interchangeable backends**, chosen by
`APPLYTRACK_EMAIL_BACKEND`:

| Backend | Use |
|---|---|
| `console` (default) | Writes each email to the log. Development, and deployments without a sending domain |
| `resend` | Resend's HTTP API (`APPLYTRACK_RESEND_API_KEY`) |
| `smtp` | Any SMTP provider: Postmark, Brevo, Amazon SES, Mailgun |
| memory | Tests only: keeps emails in a list |

Each backend reports whether a failure is **permanent** (4xx, 5xx SMTP replies) or
**temporary** (timeouts, HTTP 429 and 5xx, SMTP 4xx), and that decides whether the job
is retried. Settings are checked at startup: for example `resend` without an API key, or
a sender on `localhost`, stops the app from starting.

Application code calls `Mailer.send(to=..., template=..., locale=..., context=...)`. It
renders the template once (so a missing variable fails in the request and its tests)
and queues a `send_email` job. Templates are Jinja2 files in `mail/templates/`, in
Arabic (right to left) and English. Each has a plain-text and an HTML version, and the
HTML is autoescaped. The app name comes from settings, so a rebrand doesn't touch them.

## Alternatives considered

- **arq or RQ on Redis**: mature, but adds a paid service, can't be in the same
  transaction as the database write, and arq is async while our services are sync. RQ
  needs `fork`, which Windows development machines don't have.
- **Celery**: far more than we need, and also needs a broker.
- **procrastinate (a PostgreSQL queue library)**: the same idea, but it brings its own
  schema outside Alembic and doesn't run on the SQLite test database.
- **FastAPI `BackgroundTasks`**: runs after the response in the same process, but jobs
  are lost on restart and can't be retried later.
- **Sending inside the request**: the user waits for the provider, and an outage fails
  the request.

## Consequences

- No new infrastructure, and emails are never lost or sent for rolled-back changes.
- PostgreSQL handles queue traffic too. Polling is one indexed query every
  `APPLYTRACK_WORKER_POLL_SECONDS` (2) while idle. That's fine for thousands of jobs a
  day; a dedicated broker would be the next step beyond that.
- The worker keeps querying while it runs, so on Neon the compute stays awake while
  the API is up. Render's `/ready` health checks already did the same.
- A queued email holds its links (for example a reset token) in `jobs.payload` until it
  is sent; the payload is cleared when the job finishes. Tokens must expire quickly.
- With `console` in production, emails, including any links, go to the logs. That's
  acceptable before launch; switch to a provider before real users sign up.
- Scheduled work (#45, daily reminders) can be added as jobs with a future `run_at`.
