import { ensureFreshSession } from "@/lib/auth/fresh-session";
import { getCurrentUser } from "@/lib/auth/session";
import { extensionError, notFromAWebsite } from "@/lib/extension";

/** Whether the extension's user is logged in to Sekka in this browser. Says only yes or no. */
export async function GET(request: Request): Promise<Response> {
  if (!notFromAWebsite(request)) return extensionError("forbidden", 403);
  await ensureFreshSession();
  const user = await getCurrentUser();
  return Response.json({ signed_in: user !== null }, { headers: { "Cache-Control": "no-store" } });
}
