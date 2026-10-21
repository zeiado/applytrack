"use server";

import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { clientIpFrom, type TokenResponse } from "@/lib/api/client";

import { ACCESS_COOKIE, clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from "./cookies";
import { type ActionState, safeNextPath, toActionError } from "./errors";
import { refreshTokens } from "./refresh";
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
const HOME_AFTER_LOGIN = "/dashboard";

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

async function startSession(tokens: TokenResponse, next: unknown): Promise<never> {
  setSessionCookies(await cookies(), tokens);
  return redirect({ href: safeNextPath(next) ?? HOME_AFTER_LOGIN, locale: await getLocale() });
}

/** For actions that need the user: the proxy only refreshes on page loads, so a form
 * sent long after the page loaded may find the access token expired. */
async function ensureFreshSession(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (cookieStore.has(ACCESS_COOKIE) || !refreshToken) return;
  const result = await refreshTokens(refreshToken, clientIpFrom(await headers()));
  if (result.status === "refreshed") setSessionCookies(cookieStore, result.tokens);
  else if (result.status === "invalid") clearSessionCookies(cookieStore);
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
    if (!created.data) return { error: toActionError(created.error, created.response), email };
    const login = await requestTokens(email, password);
    if (!login.data) return { error: toActionError(login.error, login.response), email };
    tokens = login.data;
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
  return startSession(result.data, next);
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
