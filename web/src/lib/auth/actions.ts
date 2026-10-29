"use server";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import type { TokenResponse } from "@/lib/api/client";

import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from "./cookies";
import { type ActionState, safeNextPath, toActionError } from "./errors";
import { ensureFreshSession } from "./fresh-session";
import { visitorApi } from "./session";

// Each action runs on this server: the browser posts the form here, never to the API.
// Next.js checks the Origin of every Server Action request, which stops cross-site
// form posts (CSRF).

const NETWORK_ERROR: ActionState = { error: { code: "network" } };

/** The API couldn't be reached (or answered with something that isn't JSON). Logged
 * on this server, where Vercel keeps it; the visitor sees a "try again" message. */
function networkError(error: unknown): ActionState {
  console.error("API request failed", error);
  return NETWORK_ERROR;
}
const HOME_AFTER_LOGIN = "/applications";

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

async function startSession(tokens: TokenResponse, next: unknown): Promise<never> {
  setSessionCookies(await cookies(), tokens);
  return redirect({ href: safeNextPath(next) ?? HOME_AFTER_LOGIN, locale: await getLocale() });
}

async function requestTokens(email: string, password: string) {
  const api = await visitorApi();
  return api.POST("/api/v1/auth/login", {
    body: { username: email, password, scope: "" },
    bodySerializer: (body) => new URLSearchParams(body as Record<string, string>),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

export async function logIn(_state: ActionState, form: FormData): Promise<ActionState> {
  const email = text(form, "email");
  let result;
  try {
    result = await requestTokens(email, text(form, "password"));
  } catch (error) {
    return { ...networkError(error), email };
  }
  if (!result.data) return { error: toActionError(result.error, result.response), email };
  return startSession(result.data, form.get("next"));
}

export async function register(_state: ActionState, form: FormData): Promise<ActionState> {
  const email = text(form, "email");
  const password = text(form, "password");
  let tokens;
  try {
    const api = await visitorApi();
    const created = await api.POST("/api/v1/auth/register", {
      body: { email, password, locale: await getLocale() },
    });
    if (!created.data) {
      const error = toActionError(created.error, created.response);
      if (error.code !== "email_taken") return { error, email };
      // Signing up again with your own email and password just logs you in. A wrong
      // password (or a Google-only account) still gets "this email already exists".
      const existing = await requestTokens(email, password);
      if (!existing.data) return { error, email };
      tokens = existing.data;
    } else {
      const login = await requestTokens(email, password);
      if (!login.data) return { error: toActionError(login.error, login.response), email };
      tokens = login.data;
    }
  } catch (error) {
    return { ...networkError(error), email };
  }
  return startSession(tokens, null);
}

export async function signInWithGoogle(idToken: string, next: string | null): Promise<ActionState> {
  let result;
  try {
    const api = await visitorApi();
    result = await api.POST("/api/v1/auth/google", {
      body: { id_token: idToken, locale: await getLocale() },
    });
  } catch (error) {
    return networkError(error);
  }
  if (!result.data) return { error: toActionError(result.error, result.response) };
  // Google's button calls this from its own callback, not from a form. A redirect() here
  // reaches the page as a rejected promise that the router has to catch, and that hand-off
  // could leave people signed in on a broken page. So: set the cookies, hand back where to
  // go, and let the page load it in full.
  setSessionCookies(await cookies(), result.data);
  const locale = await getLocale();
  return { ok: true, redirectTo: `/${locale}${safeNextPath(next) ?? HOME_AFTER_LOGIN}` };
}

export async function logOut(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      const api = await visitorApi();
      await api.POST("/api/v1/auth/logout", { body: { refresh_token: refreshToken } });
    } catch {
      // Signed out here either way; the token expires on its own.
    }
  }
  clearSessionCookies(cookieStore);
  redirect({ href: "/", locale: await getLocale() });
}

export async function requestPasswordReset(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = text(form, "email");
  try {
    const api = await visitorApi();
    const { error, response } = await api.POST("/api/v1/auth/forgot-password", {
      body: { email },
    });
    return response.ok ? { ok: true } : { error: toActionError(error, response), email };
  } catch (error) {
    return { ...networkError(error), email };
  }
}

export async function resetPassword(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const api = await visitorApi();
    const { error, response } = await api.POST("/api/v1/auth/reset-password", {
      body: { token: text(form, "token"), new_password: text(form, "password") },
    });
    if (!response.ok) return { error: toActionError(error, response) };
  } catch (error) {
    return networkError(error);
  }
  // The reset signed out every session, this browser's included.
  clearSessionCookies(await cookies());
  return { ok: true };
}

export async function verifyEmail(token: string): Promise<ActionState> {
  try {
    const api = await visitorApi();
    const { error, response } = await api.POST("/api/v1/auth/verify-email", { body: { token } });
    return response.ok ? { ok: true } : { error: toActionError(error, response) };
  } catch (error) {
    return networkError(error);
  }
}

export async function resendVerificationEmail(): Promise<ActionState> {
  try {
    await ensureFreshSession();
    const api = await visitorApi();
    const { error, response } = await api.POST("/api/v1/auth/verify-email/resend");
    return response.ok ? { ok: true } : { error: toActionError(error, response) };
  } catch (error) {
    return networkError(error);
  }
}
