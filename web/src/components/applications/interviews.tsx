"use client";

import { CalendarClock, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";

import { FormError } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteInterview, type DetailFormState, saveInterview } from "@/lib/applications/actions";
import type { InterviewField } from "@/lib/applications/interview-form";
import { type Interview, INTERVIEW_KINDS } from "@/lib/applications/model";
import { formatDateTime, utcToZoned } from "@/lib/applications/zoned-time";
import type { ActionError } from "@/lib/auth/errors";
import { cn } from "@/lib/utils";

import { NativeSelect } from "./native-select";

type Props = { applicationId: string; interviews: Interview[]; timeZone: string; now: string };

/** The application's interviews, earliest first, each editable in place. */
export function Interviews({ applicationId, interviews, timeZone, now }: Props) {
  const t = useTranslations("Detail.interviews");
  // Which form is open: "new", an interview's id, or none.
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      {interviews.length === 0 && open !== "new" && <p className="text-muted-foreground text-sm">{t("empty")}</p>}
      <ul className="grid gap-3">
        {interviews.map((interview) => (
          <li key={interview.id}>
            {open === interview.id ? (
              <InterviewForm
                applicationId={applicationId}
                interview={interview}
                timeZone={timeZone}
                onDone={() => setOpen(null)}
              />
            ) : (
              <InterviewItem
                applicationId={applicationId}
                interview={interview}
                timeZone={timeZone}
                upcoming={interview.scheduled_at > now}
                onEdit={() => setOpen(interview.id)}
              />
            )}
          </li>
        ))}
      </ul>
      {open === "new" ? (
        <InterviewForm applicationId={applicationId} timeZone={timeZone} onDone={() => setOpen(null)} />
      ) : (
        <Button variant="outline" className="h-10 w-fit gap-1.5" onClick={() => setOpen("new")}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      )}
    </div>
  );
}

function InterviewItem({
  applicationId,
  interview,
  timeZone,
  upcoming,
  onEdit,
}: {
  applicationId: string;
  interview: Interview;
  timeZone: string;
  upcoming: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("Detail.interviews");
  const tKind = useTranslations("InterviewKind");
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ActionError>();
  const [pending, startTransition] = useTransition();

  return (
    <article className={cn("bg-card grid gap-2 rounded-lg border p-3", upcoming && "border-primary/40")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            <CalendarClock aria-hidden className="text-primary size-4" />
            {formatDateTime(interview.scheduled_at, locale, timeZone)}
            {upcoming && (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                {t("upcoming")}
              </span>
            )}
          </h3>
          <p className="text-muted-foreground text-sm">
            {[
              tKind(interview.kind),
              interview.duration_minutes && t("minutes", { minutes: interview.duration_minutes }),
              interview.interviewer && t("with", { name: interview.interviewer }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {!confirming && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              {t("edit")}
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>
              {t("delete")}
            </Button>
          </div>
        )}
      </div>
      {interview.notes && (
        <p dir="auto" className="text-start text-sm whitespace-pre-line">
          {interview.notes}
        </p>
      )}
      {confirming && (
        <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label={t("deleteConfirm")}>
          <span className="text-sm">{t("deleteConfirm")}</span>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            autoFocus
            onClick={() =>
              startTransition(async () => {
                const result = await deleteInterview(applicationId, interview.id);
                if ("error" in result) setError(result.error);
              })
            }
          >
            {t("yes")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            {t("cancel")}
          </Button>
        </div>
      )}
      <FormError error={error} />
    </article>
  );
}

function InterviewForm({
  applicationId,
  interview,
  timeZone,
  onDone,
}: {
  applicationId: string;
  interview?: Interview;
  timeZone: string;
  onDone: () => void;
}) {
  const t = useTranslations("Detail.interviews");
  const tKind = useTranslations("InterviewKind");
  const save = saveInterview.bind(null, applicationId, interview?.id ?? null);
  const [state, action, pending] = useActionState(async (previous: DetailFormState, form: FormData) => {
    const result = await save(previous, form);
    if (result?.ok) onDone();
    return result;
  }, undefined);
  const invalid = new Set<InterviewField>(state?.invalid ?? []);
  const initial = (name: InterviewField): string => {
    if (state?.values) return state.values[name] ?? "";
    if (!interview) return name === "kind" ? "phone_screen" : "";
    if (name === "scheduled_at") return utcToZoned(interview.scheduled_at, timeZone);
    const stored = interview[name];
    return stored === null || stored === undefined ? "" : String(stored);
  };
  const id = (name: InterviewField) => `${interview?.id ?? "new"}-${name}`;

  return (
    <form action={action} className="bg-muted/40 grid gap-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={id("scheduled_at")}>{t("when")}</Label>
          <Input
            id={id("scheduled_at")}
            name="scheduled_at"
            type="datetime-local"
            required
            defaultValue={initial("scheduled_at")}
            aria-invalid={invalid.has("scheduled_at") || undefined}
            aria-describedby={`${id("scheduled_at")}-hint`}
            className="h-10"
          />
          <p id={`${id("scheduled_at")}-hint`} className="text-muted-foreground text-xs">
            {t("whenHint", { timeZone })}
          </p>
          {invalid.has("scheduled_at") && <p className="text-destructive text-xs">{t("invalid.scheduled_at")}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={id("kind")}>{t("kind")}</Label>
          <NativeSelect id={id("kind")} name="kind" defaultValue={initial("kind")}>
            {INTERVIEW_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {tKind(kind)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={id("duration_minutes")}>{t("duration")}</Label>
          <Input
            id={id("duration_minutes")}
            name="duration_minutes"
            inputMode="numeric"
            dir="ltr"
            maxLength={5}
            defaultValue={initial("duration_minutes")}
            aria-invalid={invalid.has("duration_minutes") || undefined}
            className="h-10"
          />
          {invalid.has("duration_minutes") && (
            <p className="text-destructive text-xs">{t("invalid.duration_minutes")}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={id("interviewer")}>{t("interviewer")}</Label>
          <Input
            id={id("interviewer")}
            name="interviewer"
            maxLength={200}
            defaultValue={initial("interviewer")}
            className="h-10"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("notes")}>{t("notes")}</Label>
        <Textarea id={id("notes")} name="notes" rows={3} maxLength={10_000} defaultValue={initial("notes")} />
      </div>
      <FormError error={state?.error} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="h-10" disabled={pending}>
          {t("save")}
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
