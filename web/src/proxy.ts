import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { clientIpFrom } from "./lib/api/client";
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  REFRESH_COOKIE,
  setSessionCookies,
} from "./lib/auth/cookies";
import { refreshTokens } from "./lib/auth/refresh";
import { protectedRoute } from "./lib/auth/routes";

const intl = createMiddleware(routing);

/**
 * Runs before every page request:
 * 1. If the access token has expired but there's a refresh token, gets a new pair and
 *    passes it both to this request (so the page renders logged in) and to the browser.
 * 2. Sends logged-out visitors from protected pages to the login page, and logged-in
 *    ones from the login and sign-up pages to the dashboard. These are only quick
 *    checks on cookies; pages still check the session with the API.
 * 3. Adds the language to URLs without one (next-intl).
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const session = await refreshIfExpired(request);
  const loggedIn = session.request.cookies.has(ACCESS_COOKIE);

  const match = /^\/(ar|en)(\/.*)?$/.exec(request.nextUrl.pathname);
  if (match) {
    const [, locale, rest = "/"] = match;
    const kind = protectedRoute(rest);
    if (kind === "member" && !loggedIn) {
      const login = new URL(`/${locale}/login`, request.url);
      login.searchParams.set("next", rest + request.nextUrl.search);
      return session.apply(NextResponse.redirect(login));
    }
    if (kind === "guest" && loggedIn) {
      return session.apply(NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url)));
    }
  }
  return session.apply(intl(session.request));
}

type Session = { request: NextRequest; apply: (response: NextResponse) => NextResponse };

async function refreshIfExpired(request: NextRequest): Promise<Session> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const unchanged: Session = { request, apply: (response) => response };
  // Only for requests without a body: page loads and prefetches. Forms (Server
  // Actions) refresh on their own if they need to.
  if (request.cookies.has(ACCESS_COOKIE) || !refreshToken) return unchanged;
  if (request.method !== "GET" && request.method !== "HEAD") return unchanged;

  const result = await refreshTokens(refreshToken, clientIpFrom(request.headers));
  if (result.status === "unavailable") return unchanged;

  const cookies = new Map(request.cookies.getAll().map((c) => [c.name, c.value]));
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
  if (result.status === "refreshed") {
    cookies.set(ACCESS_COOKIE, result.tokens.access_token);
    cookies.set(REFRESH_COOKIE, result.tokens.refresh_token);
  }
  const headers = new Headers(request.headers);
  headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));

  return {
    request: new NextRequest(request.url, { headers, method: request.method }),
    apply: (response) => {
      if (result.status === "refreshed") setSessionCookies(response.cookies, result.tokens);
      else clearSessionCookies(response.cookies);
      return response;
    },
  };
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
