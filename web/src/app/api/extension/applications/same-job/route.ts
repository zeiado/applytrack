import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ensureFreshSession } from "@/lib/auth/fresh-session";
import { visitorApi } from "@/lib/auth/session";
import { extensionError, notFromAWebsite } from "@/lib/extension";

const NO_STORE = { "Cache-Control": "no-store" };

/** Whether the job at `?url=` is already saved, so the extension can warn before saving it
 * twice. Answers with only what the warning shows: each match's id, stage and date. */
export async function GET(request: Request): Promise<Response> {
  if (!notFromAWebsite(request)) return extensionError("forbidden", 403);
  const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!url || url.length > 2048) return Response.json({ matches: [] }, { headers: NO_STORE });

  await ensureFreshSession();
  if (!(await cookies()).has(ACCESS_COOKIE)) return extensionError("not_signed_in", 401);

  let result;
  try {
    result = await (await visitorApi()).GET("/api/v1/applications/same-job", {
      params: { query: { job_url: url } },
    });
  } catch (error) {
    console.error("API request failed", error);
    return extensionError("network", 502);
  }
  if (result.data) {
    const matches = result.data.map(({ id, status, created_at }) => ({ id, status, created_at }));
    return Response.json({ matches }, { headers: NO_STORE });
  }
  if (result.response.status === 401) return extensionError("not_signed_in", 401);
  return extensionError("unknown", 502);
}
