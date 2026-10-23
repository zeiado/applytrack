import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry";

// Errors on the server (#70): pages, Server Actions and route handlers. Off without
// NEXT_PUBLIC_SENTRY_DSN.
export function register(): void {
  Sentry.init(sentryOptions());
}

export const onRequestError = Sentry.captureRequestError;
