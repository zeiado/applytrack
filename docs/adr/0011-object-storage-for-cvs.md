# 11. Object storage for CVs

- Status: Accepted
- Date: 2026-10-26

## Context

Users upload their CV once so Sekka AI can tailor it to each job (#115). CVs are PDF or
Word files of up to a few megabytes. The API runs on Render, whose disk is wiped on every
deploy, and the database is Neon Postgres, whose free plan holds 0.5 GB and isn't made
for files. The web app runs on Vercel, whose functions refuse request bodies over 4.5 MB.
CVs hold personal data: they must stay private and be deleted with the account.

## Decision

- **Files go to an S3-compatible bucket: Cloudflare R2.** Free for the first 10 GB a
  month, no fees for downloads, and the standard S3 API (boto3), so we can move to
  another provider by changing four settings. Two private buckets, `sekka-cvs` and
  `sekka-cvs-staging`, each with its own API token that can only read and write that
  bucket. No public access.
- **Browsers upload straight to the bucket with a signed link** (`POST /cvs`), so files
  never pass through Vercel or the API. The link is valid for 10 minutes and signs the
  `Content-Type` and `Content-Length` the user announced: PDF or `.docx`, up to 5 MB.
  The bucket refuses any other file. The bucket's CORS rule lets only the web app's
  origins upload (docs/deployment.md).
- **The API checks, then reads the file on the job queue** (ADR 0007). `POST
  /cvs/{id}/complete` checks the file exists with the announced size, then queues
  `extract_cv_text`. The worker downloads it, checks the first bytes match the type
  (`%PDF-` or a zip with `word/document.xml`), refuses Word files that unpack to more
  than 30 MB, and reads up to 30 pages and 50,000 characters of text (pypdf,
  python-docx). The CV becomes `ready`, or `failed` with a reason the web app shows
  (`wrong_type`, `encrypted`, `unreadable`, `no_text`, `storage_error`).
- **Downloads use signed links too**, valid for 5 minutes, that save the file under its
  original name.
- **Deleting is queued.** Deleting a CV or an account deletes the rows at once and
  queues `delete_stored_file` jobs in the same transaction, so a storage outage never
  blocks a deletion; the jobs retry for about four hours. Uploads never completed are
  deleted after an hour by a periodic task.
- **At most 3 CVs per user**, so storage use stays bounded (3 × 5 MB per user).
- **Development and end-to-end tests use a local folder** (`APPLYTRACK_STORAGE_LOCAL_DIR`)
  served by the API at `/local-storage/...` with the same kind of signed links, so the
  web app uploads the same way everywhere. Production refuses this setting.

## Consequences

- Uploads don't cost the API or Vercel any bandwidth, and file size isn't limited by
  Vercel.
- The bucket's CORS rule must list each web app origin, including a new domain.
- A file the user uploaded to a signed link but never completed can exist for up to an
  hour before cleanup.
- Text from scanned CVs (images) isn't read: those fail with `no_text`. OCR can come
  later.
- R2 is a new service that receives personal data: it's listed in the privacy policy.
