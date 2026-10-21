import "server-only";

import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

export type ApiError = components["schemas"]["ErrorResponse"];
export type TokenResponse = components["schemas"]["TokenResponse"];
export type UserRead = components["schemas"]["UserRead"];

// The API is called from the Next.js server only, which holds the user's tokens in
// httpOnly cookies (ADR 0010). Browsers never talk to the API or see a token.
export function apiClient(options: { clientIp?: string | null; accessToken?: string } = {}) {
  return createClient<paths>({ baseUrl: apiUrl(), headers: apiHeaders(options), fetch: sendRequest });
}

/** openapi-fetch hands over a Request object. Node's fetch (undici) fails with "expected
 * non-null body source" when such a POST gets a 401 with WWW-Authenticate, which the API
 * sends for a wrong password or an expired refresh token. Sending the body as text
 * avoids it; API request bodies are small JSON or form data. */
export async function sendRequest(request: Request): Promise<Response> {
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.text() : undefined,
    signal: request.signal,
    redirect: "manual",
  });
}

export function apiUrl(): string {
  const url = process.env.API_URL ?? "http://localhost:8000";
  return url.replace(/\/+$/, "");
}

/** Headers for an API call made for a visitor. With API_PROXY_SECRET set (the API's
 * APPLYTRACK_CLIENT_IP_SECRET), the API applies rate limits to the visitor's IP
 * instead of this server's. */
export function apiHeaders({
  clientIp,
  accessToken,
}: {
  clientIp?: string | null;
  accessToken?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  const secret = process.env.API_PROXY_SECRET;
  if (secret && clientIp) {
    headers["X-Proxy-Secret"] = secret;
    headers["X-Client-IP"] = clientIp;
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

/** The visitor's IP. Vercel sets x-real-ip and overwrites x-forwarded-for, so neither
 * can be forged by the visitor there. Locally there's none, which is fine. */
export function clientIpFrom(headers: Headers): string | null {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null;
}
