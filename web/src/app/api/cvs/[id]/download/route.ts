import { NextResponse } from "next/server";

import { ensureFreshSession } from "@/lib/auth/fresh-session";
import { visitorApi } from "@/lib/auth/session";

/** Downloads a CV: asks the API for a short-lived link to the file and sends the
 * browser there, so the file comes straight from storage. */
export async function GET(request: Request, { params }: RouteContext<"/api/cvs/[id]/download">) {
  const { id } = await params;
  await ensureFreshSession();
  const { data, response } = await (await visitorApi()).GET("/api/v1/cvs/{cv_id}/download", {
    params: { path: { cv_id: id } },
  });
  if (response.status === 401) {
    return NextResponse.redirect(new URL("/login?next=/profile", request.url));
  }
  if (!data) {
    return new Response("The download failed. Try again in a moment.", {
      status: response.status === 404 || response.status === 422 ? 404 : 502,
    });
  }
  const redirect = NextResponse.redirect(data.url, 303);
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}
