import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { apiClient, clientIpFrom, type UserRead } from "@/lib/api/client";

import { ACCESS_COOKIE } from "./cookies";

/** An API client acting for the current visitor (their IP, and their token if any). */
export async function visitorApi() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return apiClient({
    clientIp: clientIpFrom(headerStore),
    accessToken: cookieStore.get(ACCESS_COOKIE)?.value,
  });
}

/** The logged-in user, or null. The proxy has already refreshed an expired access
 * token, so a missing or rejected one means there's no session. Once per request. */
export const getCurrentUser = cache(async (): Promise<UserRead | null> => {
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_COOKIE)) return null;
  const { data } = await (await visitorApi()).GET("/api/v1/users/me");
  return data ?? null;
});
