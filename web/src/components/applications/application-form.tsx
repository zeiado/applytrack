"use client";

import { useTranslations } from "next-intl";
import { type ComponentProps, useActionState } from "react";

import { FormError, SubmitButton } from "@/components/auth/form-parts";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { FormState } from "@/lib/applications/actions";
import type { Field } from "@/lib/applications/form";
import { type ApplicationDetail, SOURCES } from "@/lib/applications/model";

import { NativeSelect } from "./native-select";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** Add (no `application`) or edit an application. */
export function ApplicationForm({ action, application }: { action: Action; application?: ApplicationDetail }) {
  const t = useTranslations("ApplicationForm");
  const tSource = useTranslations("Source");
  const [state, formAction] = useActionState(action, undefined);
  const invalid = new Set(state?.invalid ?? []);

  // After a failed save, show what was typed; otherwise the stored values.
  const initial = (name: Field): string => {
    if (state?.values) return state.values[name] ?? "";
    const stored = application?.[name as keyof ApplicationDetail];
    return stored === null || stored === undefined ? "" : String(stored);
  };

  function field(name: Field, props: ComponentProps<"input"> = {}, hint?: string) {
    const describedBy = [hint && `${name}-hint`, invalid.has(name) && `${name}-error`].filter(Boolean).join(" ");
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={name}>
          {t(name)}
          {/* The salary pair says "optional" once, on its group. */}
          {!props.required && !name.startsWith("salary") && (
            <span className="text-muted-foreground text-xs font-normal">({t("optional")})</span>
          )}
        </Label>
        <Input
          id={name}
          name={name}
          defaultValue={initial(name)}
          aria-invalid={invalid.has(name) || undefined}
          aria-describedby={describedBy || undefined}
          className="h-10"
          {...props}
        />
        {hint && (
          <p id={`${name}-hint`} className="text-muted-foreground text-xs">
            {hint}
          </p>
        )}
        <FieldError name={name} show={invalid.has(name)} />
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {field("company", { required: true, maxLength: 200, autoComplete: "organization" })}
        {field("role_title", { required: true, maxLength: 200, autoComplete: "organization-title" })}
      </div>
      {field("job_url", { type: "url", dir: "ltr", maxLength: 2048, placeholder: "https://" }, t("job_urlHint"))}
      <div className="grid gap-1.5">
        <Label htmlFor="job_description">
          {t("job_description")} <span className="text-muted-foreground text-xs font-normal">({t("optional")})</span>
        </Label>
        <Textarea
          id="job_description"
          name="job_description"
          rows={6}
          maxLength={20_000}
          dir="auto"
          defaultValue={initial("job_description")}
          aria-invalid={invalid.has("job_description") || undefined}
          aria-describedby={invalid.has("job_description") ? "job_description-hint job_description-error" : "job_description-hint"}
          className="max-h-96"
        />
        <p id="job_description-hint" className="text-muted-foreground text-xs">
          {t("job_descriptionHint")}
        </p>
        <FieldError name="job_description" show={invalid.has("job_description")} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="source">{t("source")}</Label>
          <NativeSelect id="source" name="source" defaultValue={initial("source") || "job_board"}>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {tSource(source)}
              </option>
            ))}
          </NativeSelect>
        </div>
        {/* Only when adding; later stages are moves on the board. */}
        {!application && (
          <div className="grid gap-1.5">
            <Label htmlFor="status">{t("status")}</Label>
            <NativeSelect id="status" name="status" defaultValue={initial("status") || "applied"}>
              <option value="applied">{t("statusApplied")}</option>
              <option value="wishlist">{t("statusWishlist")}</option>
            </NativeSelect>
          </div>
        )}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          {t("salary")} <span className="text-muted-foreground text-xs font-normal">({t("optional")})</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {field("salary_min", { inputMode: "numeric", dir: "ltr", maxLength: 12 })}
          {field("salary_max", { inputMode: "numeric", dir: "ltr", maxLength: 12 })}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        {field("applied_on", { type: "date" })}
        {field("follow_up_on", { type: "date" }, t("follow_up_onHint"))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">
          {t("notes")} <span className="text-muted-foreground text-xs font-normal">({t("optional")})</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={10_000}
          defaultValue={initial("notes")}
          aria-invalid={invalid.has("notes") || undefined}
        />
        <FieldError name="notes" show={invalid.has("notes")} />
      </div>
      <FormError error={state?.error} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-auto sm:min-w-40">
          <SubmitButton>{application ? t("save") : t("create")}</SubmitButton>
        </div>
        <Link
          href={application ? `/applications/${application.id}` : "/applications"}
          className={buttonVariants({ variant: "ghost", className: "h-10" })}
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}

function FieldError({ name, show }: { name: Field; show: boolean }) {
  const t = useTranslations("ApplicationForm.invalid");
  if (!show) return null;
  return (
    <p id={`${name}-error`} className="text-destructive text-xs">
      {t(name)}
    </p>
  );
}
