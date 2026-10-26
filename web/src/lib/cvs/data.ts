import "server-only";

import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { visitorApi } from "@/lib/auth/session";

import type { Cv } from "./file";

/** The logged-in user's CVs, oldest first. */
export async function getCvs(): Promise<Cv[]> {
  const api = await visitorApi();
  const { data, response } = await api.GET("/api/v1/cvs");
  if (response.status === 401) {
    return redirect({ href: "/login?next=/profile", locale: await getLocale() });
  }
  if (!data) throw new Error(`Reading the CVs failed: HTTP ${response.status}`);
  return data;
}
