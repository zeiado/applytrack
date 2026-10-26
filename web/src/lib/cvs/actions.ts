"use server";

import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { type ActionError, toActionError } from "@/lib/auth/errors";
import { ensureFreshSession } from "@/lib/auth/fresh-session";
import { visitorApi } from "@/lib/auth/session";

import type { CvContentType } from "./file";

export type StartResult =
  | { id: string; url: string; headers: Record<string, string> }
  | { error: ActionError };

export type CvResult = { ok: true } | { error: ActionError };

async function memberApi() {
  await ensureFreshSession();
  return visitorApi();
}

async function toLogin(): Promise<never> {
  return redirect({ href: "/login?next=/profile", locale: await getLocale() });
}

/** Step 1: the API saves the CV and returns a link the browser uploads the file to. */
export async function startCvUpload(file: {
  filename: string;
  contentType: CvContentType;
  size: number;
  replaces?: string;
}): Promise<StartResult> {
  let result;
  try {
    result = await (await memberApi()).POST("/api/v1/cvs", {
      body: {
        filename: file.filename,
        content_type: file.contentType,
        size_bytes: file.size,
        replaces: file.replaces ?? null,
      },
    });
  } catch (error) {
    console.error("API request failed", error);
    return { error: { code: "network" } };
  }
  if (result.response.status === 401) return toLogin();
  if (!result.data) return { error: toActionError(result.error, result.response) };
  const { cv, upload } = result.data;
  return { id: cv.id, url: upload.url, headers: upload.headers };
}

/** Step 3, once the browser has uploaded the file: Sekka starts reading it. */
export async function completeCvUpload(id: string): Promise<CvResult> {
  let result;
  try {
    result = await (await memberApi()).POST("/api/v1/cvs/{cv_id}/complete", {
      params: { path: { cv_id: id } },
    });
  } catch (error) {
    console.error("API request failed", error);
    return { error: { code: "network" } };
  }
  if (result.response.status === 401) return toLogin();
  if (!result.data) return { error: toActionError(result.error, result.response) };
  refresh();
  return { ok: true };
}

export async function deleteCv(id: string): Promise<CvResult> {
  let result;
  try {
    result = await (await memberApi()).DELETE("/api/v1/cvs/{cv_id}", {
      params: { path: { cv_id: id } },
    });
  } catch (error) {
    console.error("API request failed", error);
    return { error: { code: "network" } };
  }
  if (result.response.status === 401) return toLogin();
  if (!result.response.ok) return { error: toActionError(result.error, result.response) };
  refresh();
  return { ok: true };
}
