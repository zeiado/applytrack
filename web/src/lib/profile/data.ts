import "server-only";

import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { visitorApi } from "@/lib/auth/session";

import type { Profile } from "./form";

/** The logged-in user's profile, for the profile page. */
export async function getProfile(): Promise<Profile> {
  const api = await visitorApi();
  const { data, response } = await api.GET("/api/v1/users/me/profile");
  if (response.status === 401) {
    return redirect({ href: "/login?next=/profile", locale: await getLocale() });
  }
  if (!data) throw new Error(`Reading the profile failed: HTTP ${response.status}`);
  return data;
}
