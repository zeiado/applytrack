"use server";

import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { type ActionState, toActionError } from "@/lib/auth/errors";
import { ensureFreshSession } from "@/lib/auth/fresh-session";
import { visitorApi } from "@/lib/auth/session";

import { profileBody } from "./form";

/** Saves the whole profile form. */
export async function saveProfile(_state: ActionState, form: FormData): Promise<ActionState> {
  let result;
  try {
    await ensureFreshSession();
    const api = await visitorApi();
    result = await api.PATCH("/api/v1/users/me/profile", { body: profileBody(form) });
  } catch (error) {
    console.error("API request failed", error);
    return { error: { code: "network" } };
  }
  if (result.response.status === 401) {
    return redirect({ href: "/login?next=/profile", locale: await getLocale() });
  }
  if (!result.data) return { error: toActionError(result.error, result.response) };
  refresh();
  return { ok: true };
}
