import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Adds the language to URLs that don't have one (/ → /ar or /en).
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
