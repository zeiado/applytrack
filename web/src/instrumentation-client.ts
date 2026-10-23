import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry";

// Errors in the browser (#70). Off without NEXT_PUBLIC_SENTRY_DSN.
Sentry.init(sentryOptions());
