import "server-only";

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ensureFreshSession } from "@/lib/auth/fresh-session";

import { apiHeaders, apiUrl, clientIpFrom } from "./client";

/**
 * Hands one of the API's file downloads to the browser. The browser can't call the API
 * itself, because it never has the token; this runs on the server, which does.
 *
 * Without a session, it sends the user to log in and come back to `returnTo`.
 */
export async function proxyDownload(
  request: Request,
  { path, contentType, filename, returnTo }: { path: string; contentType: string; filename: string; returnTo: string },
): Promise<Response> {
  await ensureFreshSession();
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  const toLogin = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(returnTo)}`, request.url));
  if (!accessToken) return toLogin;

  const response = await fetch(`${apiUrl()}${path}`, {
    headers: apiHeaders({
      clientIp: clientIpFrom(await headers()),
      accessToken,
    }),
    cache: "no-store",
  });
  if (response.status === 401) return toLogin;
  if (!response.ok || !response.body) {
    return new Response("The download failed. Try again in a moment.", {
      status: 502,
    });
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": response.headers.get("content-disposition") ?? `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
