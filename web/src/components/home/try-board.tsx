"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { CompanyInitial } from "@/components/applications/company-initial";
import { StatusDot } from "@/components/applications/status-badge";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/lib/applications/model";
import { withTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** The demo's four stages, in order. A card moves one stage at a time, like on the real board. */
const COLUMNS = ["wishlist", "applied", "interviewing", "offer"] as const satisfies readonly ApplicationStatus[];
type Column = (typeof COLUMNS)[number];

type DemoCard = { id: string; company: string; role: string; column: Column };

/** A small board on the home page that visitors can play with: drag a card or use its arrows.
 * Nothing is saved. Reaching "Offer" shows the amber banner, as on the real board. */
export function TryBoard() {
  const t = useTranslations();
  const locale = useLocale();
  const start = (): DemoCard[] => [
    { id: "a", company: t("Home.journey.demo.otherCompany"), role: t("Home.journey.demo.otherRole"), column: "wishlist" },
    { id: "b", company: t("Home.journey.demo.company"), role: t("Home.journey.demo.role"), column: "applied" },
    { id: "c", company: t("Home.try.thirdCompany"), role: t("Home.try.thirdRole"), column: "interviewing" },
  ];
  const [cards, setCards] = useState(start);
  const [dragging, setDragging] = useState<string | null>(null);
  const offer = cards.find((card) => card.column === "offer");

  const move = (id: string, column: Column) =>
    withTransition(() => setCards((all) => all.map((card) => (card.id === id ? { ...card, column } : card))));
  const step = (card: DemoCard, by: 1 | -1) => {
    const next = COLUMNS[COLUMNS.indexOf(card.column) + by];
    if (next) move(card.id, next);
  };
  // Arrows point the way the board reads: in Arabic, "forward" is to the left.
  const rtl = locale === "ar";
  const Back = rtl ? ChevronRight : ChevronLeft;
  const Forward = rtl ? ChevronLeft : ChevronRight;

  return (
    <div className="grid gap-4">
      {offer && (
        <div
          role="status"
          style={{ viewTransitionName: "try-offer" }}
          className="try-offer bg-yes text-yes-foreground flex items-center gap-3 rounded-2xl px-4 py-3.5"
        >
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/85">
            <span className="bg-yes size-3 rounded-full" />
          </span>
          <span className="flex-1 font-semibold">{t("Home.try.offer", { company: offer.company })}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-yes-foreground"
            onClick={() => withTransition(() => setCards(start()))}
          >
            <RotateCcw aria-hidden />
            {t("Home.try.reset")}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {COLUMNS.map((column) => {
          const here = cards.filter((card) => card.column === column);
          return (
            <section
              key={column}
              aria-label={t(`Status.${column}`)}
              onDragOver={(event) => dragging && event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging) move(dragging, column);
                setDragging(null);
              }}
              className={cn(
                "bg-muted grid min-h-48 content-start gap-2.5 rounded-2xl p-3 transition-colors",
                dragging && "outline-primary/40 outline-2 outline-dashed",
              )}
            >
              <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
                <StatusDot status={column} />
                {t(`Status.${column}`)}
                <span className="text-muted-foreground ms-auto font-normal tabular-nums">{here.length}</span>
              </h3>
              {here.map((card) => {
                const index = COLUMNS.indexOf(card.column);
                const back = COLUMNS[index - 1];
                const forward = COLUMNS[index + 1];
                return (
                  <article
                    key={card.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", card.id);
                      setDragging(card.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    style={{ viewTransitionName: `try-card-${card.id}` }}
                    className="bg-card grid cursor-grab gap-2 rounded-xl border p-3 active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2.5">
                      <CompanyInitial company={card.company} locale={locale} />
                      <div className="grid min-w-0">
                        <span className="truncate font-semibold">{card.company}</span>
                        <span className="text-muted-foreground truncate text-[0.8125rem]">{card.role}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      {back ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("Home.try.moveTo", { company: card.company, status: t(`Status.${back}`) })}
                          onClick={() => step(card, -1)}
                        >
                          <Back aria-hidden />
                        </Button>
                      ) : (
                        <span className="size-8" />
                      )}
                      {forward ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("Home.try.moveTo", { company: card.company, status: t(`Status.${forward}`) })}
                          onClick={() => step(card, 1)}
                        >
                          <Forward aria-hidden />
                        </Button>
                      ) : (
                        <span className="size-8" />
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      <p className="text-muted-foreground text-sm">{t("Home.try.dropHint")}</p>
    </div>
  );
}
