import "server-only";

// The Sekka browser extension (#69, extension/) calls the web app, not the API: the web
// app holds the session in its cookies, so whoever is logged in here is logged in there.
// Chrome sends those cookies because the extension has a host permission for this site.

const EXTENSION_ORIGIN = "chrome-extension://";

/**
 * Only the extension may use these routes. Websites can't send a chrome-extension://
 * Origin, and the SameSite=Lax session cookies don't go with their cross-site POSTs
 * anyway. EXTENSION_IDS (comma-separated) narrows it to our own extension's ids; unset,
 * any extension's origin is accepted (development, unpacked builds).
 */
export function fromExtension(request: Request): boolean {
  const origin = request.headers.get("origin") ?? "";
  if (!origin.startsWith(EXTENSION_ORIGIN)) return false;
  const allowed = (process.env.EXTENSION_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(origin.slice(EXTENSION_ORIGIN.length));
}

/** For reads: Chrome sends no Origin with an extension's GET requests. A website's
 * request is still refused, and it couldn't read the answer anyway (no CORS headers). */
export function notFromAWebsite(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || fromExtension(request);
}

export function extensionError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
