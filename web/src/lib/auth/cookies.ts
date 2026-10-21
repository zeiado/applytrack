import "server-only";

import type { TokenResponse } from "@/lib/api/client";

// __Host- cookies must be Secure, path=/ and have no Domain, so another subdomain
// can't set or read them. Browsers treat http://localhost as secure, so this works
// in development too.
export const ACCESS_COOKIE = "__Host-at";
export const REFRESH_COOKIE = "__Host-rt";

// Expire the access cookie a minute early, so a request never reaches the API with a
// token that expires on the way. The proxy refreshes it when it's gone.
const EARLY_SECONDS = 60;

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

/** What both next/headers cookies() and NextResponse.cookies can do. */
export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
}

function options(maxAge: number): CookieOptions {
  // Lax, not Strict: links from emails (another site) must still see the session.
  return { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge };
}

export function setSessionCookies(cookies: CookieWriter, tokens: TokenResponse): void {
  cookies.set(
    ACCESS_COOKIE,
    tokens.access_token,
    options(Math.max(tokens.expires_in - EARLY_SECONDS, 1)),
  );
  cookies.set(REFRESH_COOKIE, tokens.refresh_token, options(tokens.refresh_expires_in));
}

// Not cookies.delete(): its Set-Cookie has no Secure flag, and browsers ignore any
// change to a __Host- cookie without it, so the session would survive "logout".
export function clearSessionCookies(cookies: CookieWriter): void {
  cookies.set(ACCESS_COOKIE, "", options(0));
  cookies.set(REFRESH_COOKIE, "", options(0));
}
