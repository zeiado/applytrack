// Shared by server and browser code: types and constants for applications.
import type { components } from "@/lib/api/schema";

export type Application = components["schemas"]["ApplicationRead"];
export type ApplicationStatus = components["schemas"]["ApplicationStatus"];
export type ApplicationSource = components["schemas"]["ApplicationSource"];
export type ApplicationCreate = components["schemas"]["ApplicationCreate"];
export type ApplicationUpdate = components["schemas"]["ApplicationUpdate"];
export type StatusChange = components["schemas"]["StatusChangeRead"];
export type Interview = components["schemas"]["InterviewRead"];
export type InterviewKind = components["schemas"]["InterviewKind"];
export type DueReminder = components["schemas"]["DueReminder"];
export type Stats = components["schemas"]["StatsRead"];

export const INTERVIEW_KINDS = [
  "phone_screen",
  "technical",
  "behavioral",
  "onsite",
  "other",
] as const satisfies readonly InterviewKind[];

// Pipeline order: one board column each, left to right (right to left in Arabic).
export const STATUSES = [
  "wishlist",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const satisfies readonly ApplicationStatus[];

export const FINAL_STATUSES: readonly ApplicationStatus[] = ["accepted", "rejected", "withdrawn"];

export const SOURCES = [
  "job_board",
  "company_site",
  "referral",
  "recruiter",
  "other",
] as const satisfies readonly ApplicationSource[];

export const SORTS = [
  "-created_at",
  "created_at",
  "-applied_on",
  "applied_on",
  "company",
  "-company",
] as const;
export type Sort = (typeof SORTS)[number];

// The API's largest page.
export const MAX_PAGE_SIZE = 100;
