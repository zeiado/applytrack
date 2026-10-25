import "server-only";

import { cookies } from "next/headers";

import type { Application } from "@/lib/applications/model";

// The first-run guide on the board (#108). Kept in cookies, so it's per browser: enough
// for a hint, and nothing to store in the API.
const GUIDE_COOKIE = "__Host-guide"; // "done": hidden for good
const EXTENSION_COOKIE = "__Host-ext"; // "1": the extension saved a job from this browser
const YEAR = 60 * 60 * 24 * 365;

const options = { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: YEAR } as const;

// The Chrome Web Store page; empty until the extension is published (#112).
export const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL ?? "";

export type GuideStep = { key: "add" | "followUp" | "extension"; done: boolean; href: string };

/** The steps to show, or null once the guide is done or hidden. */
export async function guideSteps(applications: Application[]): Promise<GuideStep[] | null> {
  const jar = await cookies();
  if (jar.get(GUIDE_COOKIE)?.value === "done") return null;
  // A follow-up date anywhere means the user has the idea; the guide's job is done.
  if (applications.some((app) => app.follow_up_on)) return null;

  const newest = applications[0];
  const steps: GuideStep[] = [
    { key: "add", done: applications.length > 0, href: "/applications/new" },
    {
      key: "followUp",
      done: false,
      href: newest ? `/applications/${newest.id}#follow_up_on` : "/applications/new",
    },
  ];
  if (EXTENSION_URL) {
    steps.push({ key: "extension", done: jar.get(EXTENSION_COOKIE)?.value === "1", href: EXTENSION_URL });
  }
  return steps;
}

/** Hides the guide in this browser: the user closed it, or set a follow-up date. */
export async function finishGuide(): Promise<void> {
  (await cookies()).set(GUIDE_COOKIE, "done", options);
}

/** Called when the extension saves a job: its cookies are this browser's. */
export async function markExtensionUsed(): Promise<void> {
  (await cookies()).set(EXTENSION_COOKIE, "1", options);
}
