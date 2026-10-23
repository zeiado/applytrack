import type { BrowserOptions, ErrorEvent } from "@sentry/nextjs";

// Error tracking with Sentry (#70). Off unless NEXT_PUBLIC_SENTRY_DSN is set. Events
// carry no personal data (docs/privacy.md): no user, cookies, headers or request
// bodies, URLs lose their query and #fragment (email links put tokens there), and
// email addresses in messages are masked. No session replay, no tracing.

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

export function maskEmails(text: string): string {
  return text.replace(EMAIL, "[email]");
}

export function stripUrl(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = stripUrl(event.request.url);
  }
  if (event.message) event.message = maskEmails(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = maskEmails(exception.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = maskEmails(crumb.message);
    if (crumb.data) {
      for (const key of ["url", "from", "to"]) {
        const value = crumb.data[key];
        if (typeof value === "string") crumb.data[key] = stripUrl(value);
      }
    }
  }
  return event;
}

/** The options every runtime (browser, Node.js, edge) starts Sentry with. */
export function sentryOptions(): BrowserOptions {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Sentry 11 collects users, cookies, headers, bodies and query strings by default.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
    },
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  };
}
