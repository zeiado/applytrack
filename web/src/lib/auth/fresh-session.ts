import "server-only";

import { cookies, headers } from "next/headers";

import { clientIpFrom } from "@/lib/api/client";

import { ACCESS_COOKIE, clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from "./cookies";
import { refreshTokens } from "./refresh";

/** For Server Actions that need the user. The proxy only refreshes on page loads, so a
 * form sent long after the page loaded may find the access token expired. */
export async function ensureFreshSession(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (cookieStore.has(ACCESS_COOKIE) || !refreshToken) return;
  const result = await refreshTokens(refreshToken, clientIpFrom(await headers()));
  if (result.status === "refreshed") setSessionCookies(cookieStore, result.tokens);
  else if (result.status === "invalid") clearSessionCookies(cookieStore);
}
