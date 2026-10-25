"use server";

import { refresh } from "next/cache";

import { finishGuide } from "./guide";

/** The guide's "Hide" button. */
export async function hideGuide(): Promise<void> {
  await finishGuide();
  refresh();
}
