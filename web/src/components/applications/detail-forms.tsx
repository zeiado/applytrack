"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { FormError } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeStatus, setFollowUp } from "@/lib/applications/actions";
import type { Application } from "@/lib/applications/model";

import { NativeSelect } from "./native-select";

/** Move to one of the allowed next stages, with an optional note for the history. */
export function MoveForm({ application }: { application: Application }) {
  const t = useTranslations("Detail.move");
  const tStatus = useTranslations("Status");
  const [state, action, pending] = useActionState(changeStatus.bind(null, application.id), undefined);

  if (application.next_statuses.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("final", { status: tStatus(application.status) })}</p>;
  }
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="move-status">{t("to")}</Label>
        <NativeSelect id="move-status" name="status" defaultValue={application.next_statuses[0]}>
          {application.next_statuses.map((status) => (
            <option key={status} value={status}>
              {tStatus(status)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="move-note">{t("note")}</Label>
        <Input id="move-note" name="note" maxLength={10_000} placeholder={t("notePlaceholder")} className="h-10" />
      </div>
      <FormError error={state?.error} />
      <Button type="submit" className="h-10 w-full sm:w-fit sm:px-6" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}

/** The follow-up date: the morning reminder email goes out on it. */
export function FollowUpForm({ application }: { application: Application }) {
  const t = useTranslations("Detail.followUp");
  const [state, action, pending] = useActionState(setFollowUp.bind(null, application.id), undefined);

  return (
    <div className="grid gap-3">
      <form action={action} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="follow_up_on">{t("date")}</Label>
          <Input
            id="follow_up_on"
            name="follow_up_on"
            type="date"
            // Re-mounts with the stored date after each save.
            key={application.follow_up_on ?? "none"}
            defaultValue={application.follow_up_on ?? ""}
            aria-describedby="follow_up_on-hint"
            className="h-10"
          />
          <p id="follow_up_on-hint" className="text-muted-foreground text-xs">
            {t("hint")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" className="h-10" disabled={pending}>
            {t("save")}
          </Button>
          {application.follow_up_on && (
            // Its own form: inside the one above it would also send the date field.
            <Button type="submit" variant="ghost" className="h-10" form="clear-follow-up" disabled={pending}>
              {t("clear")}
            </Button>
          )}
          {state?.ok && (
            <span role="status" className="text-muted-foreground text-sm">
              {t("saved")}
            </span>
          )}
        </div>
      </form>
      <form id="clear-follow-up" action={action} hidden>
        <input type="hidden" name="follow_up_on" value="" />
      </form>
      <FormError error={state?.error} />
    </div>
  );
}
