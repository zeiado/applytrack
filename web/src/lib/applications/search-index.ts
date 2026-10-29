"use server";

import { allApplications } from "./data";
import type { ApplicationStatus } from "./model";

export type SearchEntry = { id: string; company: string; role_title: string; status: ApplicationStatus };

/** What the search box searches: your applications, just the fields it shows. Loaded each
 * time the box opens, so it's never stale. */
export async function searchIndex(): Promise<SearchEntry[]> {
  const { items } = await allApplications();
  return items.map(({ id, company, role_title, status }) => ({ id, company, role_title, status }));
}
