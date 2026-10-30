"use client";

import { Check, Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { CompanyInitial } from "@/components/applications/company-initial";
import { StatusBadge } from "@/components/applications/status-badge";
import { FormError } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { type DetailFormState, setFollowUp } from "@/lib/applications/actions";
import { addDays } from "@/lib/applications/dates";
import type { DueReminder } from "@/lib/applications/model";
import { cn } from "@/lib/utils";

const SNOOZE_DAYS = 3;

/** One follow-up: what it's for, how late it is, and "done" or "remind me later".
 * Both just change the application's follow-up date, so the inbox refreshes itself. */
export function FollowUpItem({ reminder, today, date }: { reminder: DueReminder; today: string; date: string }) {
  const t = useTranslations("FollowUps");
  const toast = useToast();
  // Done and snooze both change the follow-up date; the toast's Undo puts the old one back.
  const [state, action, pending] = useActionState(async (previous: DetailFormState, form: FormData) => {
    const result = await setFollowUp(reminder.application_id, previous, form);
    if (result?.ok) {
      const snoozed = String(form.get("follow_up_on") ?? "") !== "";
      const restore = new FormData();
      restore.set("follow_up_on", reminder.follow_up_on);
      toast.add({
        title: snoozed
          ? t("snoozed", { company: reminder.company, days: SNOOZE_DAYS })
          : t("marked", { company: reminder.company }),
        actionProps: {
          children: t("undo"),
          onClick: () => void setFollowUp(reminder.application_id, undefined, restore),
        },
      });
    }
    return result;
  }, undefined);
  const locale = useLocale();
  const late = reminder.days_overdue;

  return (
    <li className="bg-card grid grid-cols-1 gap-3 rounded-xl border p-4 sm:flex sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <CompanyInitial company={reminder.company} locale={locale} />
        <div className="grid min-w-0 gap-1">
          <Link href={`/applications/${reminder.application_id}`} className="truncate font-semibold hover:underline">
            {reminder.company}
          </Link>
          <span className="text-muted-foreground truncate text-sm">{reminder.role_title}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <StatusBadge status={reminder.status} />
            {/* Calm on purpose: a late follow-up isn't an error. Teal when it's time, grey before. */}
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs",
                late >= 0 ? "bg-primary-container text-primary-container-foreground font-medium" : "bg-muted text-muted-foreground",
              )}
            >
              {late > 0 ? t("overdueBy", { days: late }) : late === 0 ? t("dueToday") : t("dueIn", { days: -late })}
              <span className="font-normal"> · {date}</span>
            </span>
          </span>
          <FormError error={state?.error} />
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="follow_up_on" value="" />
          <Button
            type="submit"
            variant="outline"
            className="h-10 gap-1.5"
            disabled={pending}
            aria-label={t("doneFor", { company: reminder.company })}
          >
            <Check aria-hidden />
            {t("done")}
          </Button>
        </form>
        {/* Snoozing one that isn't due yet could bring it forward. */}
        {late >= 0 && (
          <form action={action}>
            <input type="hidden" name="follow_up_on" value={addDays(today, SNOOZE_DAYS)} />
            <Button
              type="submit"
              variant="ghost"
              className="h-10 gap-1.5"
              disabled={pending}
              aria-label={t("snoozeFor", { company: reminder.company, days: SNOOZE_DAYS })}
            >
              <Clock aria-hidden />
              {t("snooze", { days: SNOOZE_DAYS })}
            </Button>
          </form>
        )}
      </div>
    </li>
  );
}
