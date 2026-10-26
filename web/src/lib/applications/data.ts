import "server-only";

import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { visitorApi } from "@/lib/auth/session";

import { type Application, type ApplicationDetail, MAX_PAGE_SIZE } from "./model";
import { type ListQuery, toApiParams } from "./query";

// Reads for pages. Each runs inside a <Suspense> boundary (it needs the session).

/** A 401 means the session is over (the proxy refreshes expired ones): log in again. */
async function toLogin(next: string): Promise<never> {
  return redirect({ href: `/login?next=${encodeURIComponent(next)}`, locale: await getLocale() });
}

/** Every application, for the board. Students have tens, rarely hundreds; the API
 * pages at 100, so this asks for up to 5 pages. */
export async function allApplications(): Promise<{ items: Application[]; truncated: boolean }> {
  const api = await visitorApi();
  const items: Application[] = [];
  for (let page = 0; page < 5; page++) {
    const { data, response } = await api.GET("/api/v1/applications", {
      params: { query: { limit: MAX_PAGE_SIZE, offset: page * MAX_PAGE_SIZE, sort: "-created_at" } },
    });
    if (response.status === 401) return toLogin("/applications");
    if (!data) throw new Error(`Listing applications failed: HTTP ${response.status}`);
    items.push(...data.items);
    if (items.length >= data.total) return { items, truncated: false };
  }
  return { items, truncated: true };
}

export async function listApplications(query: ListQuery) {
  const api = await visitorApi();
  const { data, response } = await api.GET("/api/v1/applications", {
    params: { query: toApiParams(query) },
  });
  if (response.status === 401) return toLogin("/applications?view=list");
  if (!data) throw new Error(`Listing applications failed: HTTP ${response.status}`);
  return data;
}

export async function getApplication(id: string): Promise<ApplicationDetail> {
  // Not a UUID: the API would answer 422; it's simply not a page.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const api = await visitorApi();
  const { data, response } = await api.GET("/api/v1/applications/{application_id}", {
    params: { path: { application_id: id } },
  });
  if (response.status === 401) return toLogin(`/applications/${id}`);
  if (response.status === 404) notFound();
  if (!data) throw new Error(`Getting an application failed: HTTP ${response.status}`);
  return data;
}

/** Every status the application has been in, oldest first. */
export async function getHistory(id: string) {
  const api = await visitorApi();
  const { data, response } = await api.GET("/api/v1/applications/{application_id}/history", {
    params: { path: { application_id: id } },
  });
  if (response.status === 401) return toLogin(`/applications/${id}`);
  if (response.status === 404) notFound();
  if (!data) throw new Error(`Getting the history failed: HTTP ${response.status}`);
  return data;
}

/** The application's interviews, earliest first. */
export async function getInterviews(id: string) {
  const api = await visitorApi();
  const { data, response } = await api.GET("/api/v1/applications/{application_id}/interviews", {
    params: { path: { application_id: id } },
  });
  if (response.status === 401) return toLogin(`/applications/${id}`);
  if (response.status === 404) notFound();
  if (!data) throw new Error(`Getting the interviews failed: HTTP ${response.status}`);
  return data;
}

/** Follow-ups due today or earlier, and those coming up in the next `withinDays` days,
 * most overdue first. "Today" is in the user's timezone. */
export async function getDueReminders(timeZone: string, withinDays: number) {
  const api = await visitorApi();
  const { data, response } = await api.GET("/api/v1/reminders/due", {
    params: { query: { tz: timeZone, within_days: withinDays, limit: MAX_PAGE_SIZE } },
  });
  if (response.status === 401) return toLogin("/follow-ups");
  if (!data) throw new Error(`Getting the follow-ups failed: HTTP ${response.status}`);
  return data;
}

/** The funnel, rates, results per source and time in each stage. */
export async function getStats() {
  const api = await visitorApi();
  const { data, response } = await api.GET("/api/v1/stats");
  if (response.status === 401) return toLogin("/stats");
  if (!data) throw new Error(`Getting the stats failed: HTTP ${response.status}`);
  return data;
}
