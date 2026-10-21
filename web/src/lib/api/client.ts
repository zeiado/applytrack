import "server-only";

import createClient from "openapi-fetch";

import type { paths } from "./schema";

// The API is called from the Next.js server only, which holds the user's tokens in
// httpOnly cookies (#64). Browsers never talk to the API or see a token.
export function apiClient(baseUrl: string = apiUrl()) {
  return createClient<paths>({ baseUrl });
}

export function apiUrl(): string {
  const url = process.env.API_URL ?? "http://localhost:8000";
  return url.replace(/\/+$/, "");
}
