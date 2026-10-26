import { cookies } from "next/headers";

import type { components } from "@/lib/api/schema";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ensureFreshSession } from "@/lib/auth/fresh-session";
import { visitorApi } from "@/lib/auth/session";
import { extensionError, fromExtension } from "@/lib/extension";
import { markExtensionUsed } from "@/lib/onboarding/guide";

type Source = components["schemas"]["ApplicationSource"];
const SOURCES: readonly Source[] = ["job_board", "company_site", "referral", "recruiter", "other"];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// The API's limit; the extension already cuts the text to it.
const MAX_JOB_DESCRIPTION = 20_000;

/** Saves the job the extension read from a page, after the user checked it. The API
 * validates the fields; this only passes on the ones the extension may set. */
export async function POST(request: Request): Promise<Response> {
  if (!fromExtension(request)) return extensionError("forbidden", 403);

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null) return extensionError("invalid", 422);
    input = parsed as Record<string, unknown>;
  } catch {
    return extensionError("invalid", 422);
  }
  const body = {
    company: text(input.company),
    role_title: text(input.role_title),
    job_url: text(input.job_url) || null,
    job_description: text(input.job_description).slice(0, MAX_JOB_DESCRIPTION) || null,
    source: SOURCES.find((source) => source === input.source) ?? "other",
    status: input.status === "wishlist" ? ("wishlist" as const) : ("applied" as const),
  };

  await ensureFreshSession();
  if (!(await cookies()).has(ACCESS_COOKIE)) return extensionError("not_signed_in", 401);

  let result;
  try {
    result = await (await visitorApi()).POST("/api/v1/applications", { body });
  } catch (error) {
    console.error("API request failed", error);
    return extensionError("network", 502);
  }
  if (result.data) {
    await markExtensionUsed();
    return Response.json({ id: result.data.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }
  if (result.response.status === 401) return extensionError("not_signed_in", 401);
  if (result.response.status === 422) return extensionError("invalid", 422);
  return extensionError("unknown", 502);
}
