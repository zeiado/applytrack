import { NextResponse } from "next/server";

import { apiHeaders, apiUrl, clientIpFrom } from "@/lib/api/client";

/**
 * One-click unsubscribe (RFC 8058): the address in a reminder email's List-Unsubscribe
 * header. Gmail and Yahoo send it a POST when the user clicks their "Unsubscribe"
 * button, and that turns off reminder emails. The token in the address is the only
 * proof needed, so there's no session or CSRF check here.
 */
export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length > 256) return new Response(null, { status: 400 });

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}/api/v1/email/unsubscribe`, {
      method: "POST",
      headers: { ...apiHeaders({ clientIp: clientIpFrom(request.headers) }), "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("API request failed", error);
    return new Response(null, { status: 502 });
  }
  if (response.ok) return new Response(null, { status: 200 });
  return new Response(null, { status: response.status === 400 ? 400 : 502 });
}

/** The same address opened in a browser shows the page with the button. A GET never
 * unsubscribes: link scanners open every link in an email. */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const page = new URL("/unsubscribe", url);
  page.hash = new URLSearchParams({ token: url.searchParams.get("token") ?? "" }).toString();
  return NextResponse.redirect(page, 303);
}
