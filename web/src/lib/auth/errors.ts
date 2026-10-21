import type { ApiError } from "@/lib/api/client";

// API error codes the sign-in screens explain. Anything else shows "unknown".
export const KNOWN_ERRORS = [
  "invalid_credentials",
  "email_taken",
  "too_many_login_attempts",
  "too_many_reset_requests",
  "too_many_emails",
  "email_already_verified",
  "invalid_google_token",
  "google_token_expired",
  "google_email_not_verified",
  "google_account_mismatch",
  "google_unavailable",
  "google_sign_in_not_configured",
  "invalid_verification_token",
  "verification_token_expired",
  "invalid_reset_token",
  "reset_token_expired",
  "validation_error",
  "invalid_transition",
  "invalid_salary_range",
  "not_found",
  "invalid_password",
  "wrong_google_account",
  "network",
  "unknown",
] as const;

export type ErrorCode = (typeof KNOWN_ERRORS)[number];

export type ActionError = { code: ErrorCode; retryAfter?: number };

/** A form action's result: nothing yet, done, or an error to show. `email` is what
 * the user typed: React resets a form after its action runs, so the field shows it
 * again instead of going blank after, say, a wrong password. */
export type ActionState = { ok?: true; error?: ActionError; email?: string } | undefined;

export function toActionError(error: ApiError | undefined, response?: Response): ActionError {
  const code = error?.error?.code ?? "";
  const known = (KNOWN_ERRORS as readonly string[]).includes(code) ? (code as ErrorCode) : "unknown";
  const retryAfter = Number(response?.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? { code: known, retryAfter }
    : { code: known };
}

/** Only paths on this site without a language prefix (/dashboard, not /en/dashboard
 * or //evil.example), so ?next= can't send someone to another site. */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string" || !/^\/(?![/\\])[^\\]*$/.test(next)) return null;
  if (/^\/(ar|en)(\/|$)/.test(next)) return null;
  return next;
}
