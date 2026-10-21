import "server-only";

import { apiClient, type TokenResponse } from "@/lib/api/client";

export type RefreshResult =
  | { status: "refreshed"; tokens: TokenResponse }
  | { status: "invalid" } // expired, revoked or reused: the session is over
  | { status: "unavailable" }; // the API couldn't be reached; keep the cookies, try later

export async function refreshTokens(
  refreshToken: string,
  clientIp: string | null,
): Promise<RefreshResult> {
  try {
    const { data, response } = await apiClient({ clientIp }).POST("/api/v1/auth/refresh", {
      body: { refresh_token: refreshToken },
    });
    if (data) return { status: "refreshed", tokens: data };
    return response.status === 401 ? { status: "invalid" } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
