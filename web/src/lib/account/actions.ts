"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { clearSessionCookies } from "@/lib/auth/cookies";
import { type ActionState, toActionError } from "@/lib/auth/errors";
import { ensureFreshSession } from "@/lib/auth/fresh-session";
import { getCurrentUser, visitorApi } from "@/lib/auth/session";

import { isTimeZone } from "./time-zones";

async function memberApi() {
  await ensureFreshSession();
  return visitorApi();
}

async function toLogin(): Promise<never> {
  return redirect({ href: "/login?next=/settings", locale: await getLocale() });
}

function failed(error: unknown): ActionState {
  console.error("API request failed", error);
  return { error: { code: "network" } };
}

/** Email language, timezone and the morning reminder email. */
export async function updatePreferences(_state: ActionState, form: FormData): Promise<ActionState> {
  const locale = form.get("locale") === "ar" ? "ar" : "en";
  const timezone = String(form.get("timezone") ?? "");
  if (!isTimeZone(timezone)) return { error: { code: "validation_error" } };
  let result;
  try {
    const api = await memberApi();
    result = await api.PATCH("/api/v1/users/me", {
      body: { locale, timezone, reminder_emails: form.get("reminder_emails") === "on" },
    });
  } catch (error) {
    return failed(error);
  }
  if (result.response.status === 401) return toLogin();
  if (!result.data) return { error: toActionError(result.error, result.response) };
  refresh();
  return { ok: true };
}

/** An account made with Google sets its first password through the reset email,
 * which proves the inbox is theirs; a stolen session alone can't add a password. */
export async function sendSetPasswordEmail(): Promise<ActionState> {
  await ensureFreshSession();
  const user = await getCurrentUser();
  if (!user) return toLogin();
  try {
    const api = await visitorApi();
    const { error, response } = await api.POST("/api/v1/auth/forgot-password", {
      body: { email: user.email },
    });
    return response.ok ? { ok: true } : { error: toActionError(error, response) };
  } catch (error) {
    return failed(error);
  }
}

/** Deletes the account for good, confirmed with the password or a new Google sign-in. */
export async function deleteAccount(confirmation: { password: string } | { google_id_token: string }): Promise<ActionState> {
  let response;
  let error;
  try {
    const api = await memberApi();
    ({ response, error } = await api.DELETE("/api/v1/users/me", { body: confirmation }));
  } catch (cause) {
    return failed(cause);
  }
  if (response.status === 401) return toLogin();
  if (!response.ok) return { error: toActionError(error, response) };
  clearSessionCookies(await cookies());
  return redirect({ href: "/?deleted=1", locale: await getLocale() });
}

export async function deleteAccountWithPassword(_state: ActionState, form: FormData): Promise<ActionState> {
  return deleteAccount({ password: String(form.get("password") ?? "") });
}

export async function deleteAccountWithGoogle(idToken: string): Promise<ActionState> {
  return deleteAccount({ google_id_token: idToken });
}
