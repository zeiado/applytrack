import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { apiHeaders, apiUrl, clientIpFrom } from "@/lib/api/client";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ensureFreshSession } from "@/lib/auth/fresh-session";

/**
 * "Download my data": passes the API's JSON export (Egypt's PDPL right of access) to
 * the browser as a file. The browser can't call the API itself, because it never has
 * the token; this runs on the server, which does.
 */
export async function GET(request: Request): Promise<Response> {
  await ensureFreshSession();
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  const toLogin = NextResponse.redirect(new URL("/login?next=/settings", request.url));
  if (!accessToken) return toLogin;

  const response = await fetch(`${apiUrl()}/api/v1/users/me/export`, {
    headers: apiHeaders({ clientIp: clientIpFrom(await headers()), accessToken }),
    cache: "no-store",
  });
  if (response.status === 401) return toLogin;
  if (!response.ok || !response.body) {
    return new Response("The export failed. Try again in a moment.", { status: 502 });
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition":
        response.headers.get("content-disposition") ?? 'attachment; filename="applytrack-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
