import type { ExtractedJob } from "./extract";

// The extension talks to the web app, not the API: the web app holds the user's session
// in its cookies, so whoever is logged in to Sekka in this browser is logged in here,
// whether they signed in with a password or with Google. The manifest's host permission
// for the web app lets these requests carry its cookies.

export type NewApplication = ExtractedJob & { status: "applied" | "wishlist" };

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: "not_signed_in" | "invalid" | "network" | "unknown" };

export async function isSignedIn(appUrl: string): Promise<boolean | null> {
  try {
    const response = await fetch(`${appUrl}/api/extension/session`, { credentials: "include" });
    if (!response.ok) return null;
    const body = (await response.json()) as { signed_in?: boolean };
    return body.signed_in === true;
  } catch {
    return null; // can't reach the web app
  }
}

export async function saveApplication(appUrl: string, application: NewApplication): Promise<SaveResult> {
  let response: Response;
  try {
    response = await fetch(`${appUrl}/api/extension/applications`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...application, job_url: application.job_url || null }),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (response.status === 201) {
    const body = (await response.json()) as { id: string };
    return { ok: true, id: body.id };
  }
  if (response.status === 401) return { ok: false, error: "not_signed_in" };
  if (response.status === 422) return { ok: false, error: "invalid" };
  return { ok: false, error: "unknown" };
}
