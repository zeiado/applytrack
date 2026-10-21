"use server";

import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { type ActionError, toActionError } from "@/lib/auth/errors";
import { ensureFreshSession } from "@/lib/auth/fresh-session";
import { getCurrentUser, visitorApi } from "@/lib/auth/session";

import { applicationBody, type Field, type FormValues, formValues, invalidFields } from "./form";
import { type InterviewField, interviewBody, type InterviewValues, interviewValues } from "./interview-form";
import type { ApplicationStatus } from "./model";

export type FormState =
  | { error?: ActionError; invalid?: Field[]; values?: FormValues }
  | undefined;

export type MoveResult = { ok: true } | { error: ActionError };

/** For the small forms on the detail page, which stay on the page. */
export type DetailFormState =
  | { ok?: true; error?: ActionError; invalid?: InterviewField[]; values?: InterviewValues }
  | undefined;

async function memberApi() {
  await ensureFreshSession();
  return visitorApi();
}

async function toLogin(): Promise<never> {
  return redirect({ href: "/login?next=/applications", locale: await getLocale() });
}

async function toBoard(): Promise<never> {
  return redirect({ href: "/applications", locale: await getLocale() });
}

function failed(error: unknown): ActionError {
  console.error("API request failed", error);
  return { code: "network" };
}

export async function createApplication(_state: FormState, form: FormData): Promise<FormState> {
  const values = formValues(form);
  const parsed = applicationBody(form);
  if ("invalid" in parsed) {
    return { error: { code: "validation_error" }, invalid: parsed.invalid, values };
  }
  const status = form.get("status") === "wishlist" ? "wishlist" : "applied";
  let result;
  try {
    const api = await memberApi();
    result = await api.POST("/api/v1/applications", { body: { ...parsed.body, status } });
  } catch (error) {
    return { error: failed(error), values };
  }
  if (result.response.status === 401) return toLogin();
  if (!result.data) {
    const error = result.error?.error;
    return {
      error: toActionError(result.error, result.response),
      invalid: invalidFields(error?.details, error?.code),
      values,
    };
  }
  return toBoard();
}

export async function updateApplication(
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const values = formValues(form);
  const parsed = applicationBody(form);
  if ("invalid" in parsed) {
    return { error: { code: "validation_error" }, invalid: parsed.invalid, values };
  }
  let result;
  try {
    const api = await memberApi();
    result = await api.PATCH("/api/v1/applications/{application_id}", {
      params: { path: { application_id: id } },
      body: parsed.body,
    });
  } catch (error) {
    return { error: failed(error), values };
  }
  if (result.response.status === 401) return toLogin();
  if (!result.data) {
    const error = result.error?.error;
    return {
      error: toActionError(result.error, result.response),
      invalid: invalidFields(error?.details, error?.code),
      values,
    };
  }
  return redirect({ href: `/applications/${id}`, locale: await getLocale() });
}

export async function deleteApplication(id: string): Promise<{ error: ActionError } | undefined> {
  let response;
  try {
    const api = await memberApi();
    ({ response } = await api.DELETE("/api/v1/applications/{application_id}", {
      params: { path: { application_id: id } },
    }));
  } catch (error) {
    return { error: failed(error) };
  }
  if (response.status === 401) return toLogin();
  // Already gone counts as deleted.
  if (!response.ok && response.status !== 404) return { error: { code: "unknown" } };
  return toBoard();
}

/** Moves an application to another status (only moves the API allows succeed). */
export async function moveApplication(id: string, status: ApplicationStatus): Promise<MoveResult> {
  let result;
  try {
    const api = await memberApi();
    result = await api.POST("/api/v1/applications/{application_id}/status", {
      params: { path: { application_id: id } },
      body: { status },
    });
  } catch (error) {
    return { error: failed(error) };
  }
  if (result.response.status === 401) return toLogin();
  // Whether it worked or not (someone moved it in another tab), show what's stored now.
  refresh();
  return result.data ? { ok: true } : { error: toActionError(result.error, result.response) };
}

/** Moves to another status with an optional note, which the history shows. */
export async function changeStatus(
  id: string,
  _state: DetailFormState,
  form: FormData,
): Promise<DetailFormState> {
  const status = form.get("status");
  const note = String(form.get("note") ?? "").trim();
  if (typeof status !== "string" || status === "") return { error: { code: "validation_error" } };
  let result;
  try {
    const api = await memberApi();
    result = await api.POST("/api/v1/applications/{application_id}/status", {
      params: { path: { application_id: id } },
      body: { status: status as ApplicationStatus, note: note || null },
    });
  } catch (error) {
    return { error: failed(error) };
  }
  if (result.response.status === 401) return toLogin();
  refresh();
  return result.data ? { ok: true } : { error: toActionError(result.error, result.response) };
}

/** Sets (or, with an empty date, clears) the follow-up date. */
export async function setFollowUp(
  id: string,
  _state: DetailFormState,
  form: FormData,
): Promise<DetailFormState> {
  const date = String(form.get("follow_up_on") ?? "").trim();
  if (date !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: { code: "validation_error" } };
  let result;
  try {
    const api = await memberApi();
    result = await api.PATCH("/api/v1/applications/{application_id}", {
      params: { path: { application_id: id } },
      body: { follow_up_on: date || null },
    });
  } catch (error) {
    return { error: failed(error) };
  }
  if (result.response.status === 401) return toLogin();
  refresh();
  return result.data ? { ok: true } : { error: toActionError(result.error, result.response) };
}

/** Adds an interview, or edits one when `interviewId` is given. */
export async function saveInterview(
  applicationId: string,
  interviewId: string | null,
  _state: DetailFormState,
  form: FormData,
): Promise<DetailFormState> {
  const values = interviewValues(form);
  await ensureFreshSession();
  const user = await getCurrentUser();
  if (!user) return toLogin();
  const parsed = interviewBody(form, user.timezone);
  if ("invalid" in parsed) return { error: { code: "validation_error" }, invalid: parsed.invalid, values };

  let result;
  try {
    const api = await visitorApi();
    result = interviewId
      ? await api.PATCH("/api/v1/applications/{application_id}/interviews/{interview_id}", {
          params: { path: { application_id: applicationId, interview_id: interviewId } },
          body: parsed.body,
        })
      : await api.POST("/api/v1/applications/{application_id}/interviews", {
          params: { path: { application_id: applicationId } },
          body: parsed.body,
        });
  } catch (error) {
    return { error: failed(error), values };
  }
  if (result.response.status === 401) return toLogin();
  if (!result.data) return { error: toActionError(result.error, result.response), values };
  refresh();
  return { ok: true };
}

export async function deleteInterview(applicationId: string, interviewId: string): Promise<MoveResult> {
  let response;
  try {
    const api = await memberApi();
    ({ response } = await api.DELETE("/api/v1/applications/{application_id}/interviews/{interview_id}", {
      params: { path: { application_id: applicationId, interview_id: interviewId } },
    }));
  } catch (error) {
    return { error: failed(error) };
  }
  if (response.status === 401) return toLogin();
  refresh();
  return response.ok || response.status === 404 ? { ok: true } : { error: { code: "unknown" } };
}
