"use client";

import { CircleAlert, MoreHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { moveApplication } from "@/lib/applications/actions";
import { followUpState, formatDate } from "@/lib/applications/dates";
import { type Application, type ApplicationStatus, STATUSES } from "@/lib/applications/model";
import type { ActionError } from "@/lib/auth/errors";
import { cn } from "@/lib/utils";

import { CompanyInitial } from "./company-initial";
import { StatusDot } from "./status-badge";

type Move = { id: string; status: ApplicationStatus };

/**
 * One column per status. A card moves through its menu (works everywhere, including
 * phones and keyboards) or by dragging it onto a column (mouse). Either way only the
 * moves the API allows for that card (its next_statuses) are offered.
 */
export function Board({ applications, today }: { applications: Application[]; today: string }) {
  const t = useTranslations();
  const [error, setError] = useState<ActionError>();
  const [dragging, setDragging] = useState<Application | null>(null);
  const [, startTransition] = useTransition();
  // The card shows in its new column at once; if the move fails, the page's data
  // (refreshed by the action) puts it back.
  const [shown, showMove] = useOptimistic(applications, (current, move: Move) =>
    current.map((app) => (app.id === move.id ? { ...app, status: move.status, next_statuses: [] } : app)),
  );

  function move(app: Application, status: ApplicationStatus) {
    if (!app.next_statuses.includes(status)) return;
    setError(undefined);
    startTransition(async () => {
      showMove({ id: app.id, status });
      const result = await moveApplication(app.id, status);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="grid gap-3">
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            {t("Applications.moveFailed", { reason: t(`Errors.${error.code}`, { seconds: 60 }) })}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-muted-foreground hidden text-xs md:block">{t("Applications.card.dragHint")}</p>
      {/* Scrolls sideways on small screens, one column per swipe. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4">
        {STATUSES.map((status) => {
          const cards = shown.filter((app) => app.status === status);
          const canDrop = dragging?.next_statuses.includes(status) ?? false;
          return (
            <section
              key={status}
              aria-labelledby={`column-${status}`}
              className={cn(
                "bg-muted flex w-[85vw] max-w-[300px] shrink-0 snap-start scroll-mx-4 flex-col gap-2.5 rounded-2xl p-3 transition sm:w-[300px]",
                dragging && (canDrop ? "ring-primary bg-primary/5 ring-2" : "opacity-60"),
              )}
              onDragOver={(event) => {
                if (canDrop) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging && canDrop) move(dragging, status);
                setDragging(null);
              }}
            >
              <h2
                id={`column-${status}`}
                className="flex scroll-mt-4 items-center gap-2 px-1 pt-0.5 pb-1 text-[0.9375rem] font-semibold"
              >
                {t(`Status.${status}`)}
                <span className="text-muted-foreground ms-auto text-sm font-normal tabular-nums">{cards.length}</span>
              </h2>
              <ul className="flex min-h-16 flex-col gap-2.5">
                {cards.map((app) => (
                  <li key={app.id}>
                    <Card
                      app={app}
                      today={today}
                      onMove={(to) => move(app, to)}
                      onDragStart={() => setDragging(app)}
                      onDragEnd={() => setDragging(null)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  app,
  today,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  app: Application;
  today: string;
  onMove: (status: ApplicationStatus) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const followUp = app.follow_up_on ? followUpState(app.follow_up_on, today) : null;
  const href = `/applications/${app.id}`;

  return (
    <article
      draggable={app.next_statuses.length > 0}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", app.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="bg-card hover:border-primary/40 relative grid grid-cols-1 gap-2 rounded-xl border p-3.5 transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <CompanyInitial company={app.company} locale={locale} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            {/* The link covers the whole card, so a click anywhere opens it. draggable={false}
                keeps a drag on the card moving the card, not dragging the link's URL. */}
            <Link
              href={href}
              draggable={false}
              className="after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {app.company}
            </Link>
          </h3>
          <p className="text-muted-foreground truncate text-[0.8125rem]" title={app.role_title}>
            {app.role_title}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="relative z-10" aria-label={t("Applications.card.move", { company: app.company })}>
                <MoreHorizontal aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {app.next_statuses.length > 0 ? t("Applications.card.moveTo") : t("Applications.card.noMoves")}
              </DropdownMenuLabel>
              {app.next_statuses.map((status) => (
                <DropdownMenuItem key={status} onClick={() => onMove(status)}>
                  <StatusDot status={status} />
                  {t(`Status.${status}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`${href}/edit`)}>{t("Applications.card.edit")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(followUp || app.applied_on) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {app.applied_on && (
            <span className="text-muted-foreground">
              {t("Applications.card.applied", { date: formatDate(app.applied_on, locale, today) })}
            </span>
          )}
          {followUp && app.follow_up_on && (
            // Calm on purpose: a late follow-up isn't an error. Teal when it's time, grey before.
            <span
              className={cn(
                "ms-auto rounded-md px-2 py-0.5",
                followUp === "upcoming" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary font-medium",
              )}
            >
              {followUp === "overdue"
                ? t("Applications.card.followUpOverdue")
                : followUp === "due"
                  ? t("Applications.card.followUpDue")
                  : t("Applications.card.followUp", { date: formatDate(app.follow_up_on, locale, today) })}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
