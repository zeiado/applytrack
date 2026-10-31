"use client";

import { Check, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { wait } from "@/lib/autoplay";
import { cn } from "@/lib/utils";

import { DemoBar, GuideCursor } from "./guide-cursor";
import { useAutoplay } from "./use-autoplay";

type Step = "closed" | "open" | "saved";

/** A made-up job page in a browser window with the Sekka extension: click its icon to open
 * the popup (filled in from the page), then save. Nothing is saved for real. Until the
 * visitor touches it, a guide cursor plays it through: the fields fill in one by one. */
export function ExtensionDemo() {
  const t = useTranslations("Home.extension");
  const demo = useTranslations("Home.journey.demo");
  const [step, setStep] = useState<Step>("closed");
  // How many of the popup's fields are filled in; only the guide fills them one at a time.
  const [fill, setFill] = useState(3);

  const { attachRoot, attachPointer, ...play } = useAutoplay(async (cursor, signal) => {
    setStep("closed");
    await cursor.home(signal);
    await cursor.moveTo("icon", signal);
    await cursor.click(signal);
    setFill(0);
    setStep("open");
    await wait(450, signal);
    for (const filled of [1, 2, 3]) {
      setFill(filled);
      await wait(550, signal);
    }
    await cursor.moveTo("save", signal);
    await cursor.click(signal);
    setStep("saved");
    await wait(2200, signal);
    await cursor.moveTo("again", signal);
    await cursor.click(signal);
    setStep("closed");
    await wait(900, signal);
  });
  const filled = play.playing ? fill : 3;

  const fields = [
    [t("company"), demo("company")],
    [t("role"), demo("role")],
    [t("link"), t("jobUrl")],
  ];

  return (
    <div ref={attachRoot} className="relative grid gap-3">
      <div className="bg-card relative min-h-[25rem] overflow-hidden rounded-2xl border shadow-sm">
        {/* The browser's top bar: the page address, and the extension's icon at the end. */}
        <div className="bg-surface-container flex items-center gap-3 border-b px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            <span className="bg-border size-2.5 rounded-full" />
            <span className="bg-border size-2.5 rounded-full" />
            <span className="bg-border size-2.5 rounded-full" />
          </span>
          <span className="bg-background text-muted-foreground min-w-0 flex-1 truncate rounded-full px-3 py-1 text-xs" dir="ltr">
            {t("jobUrl")}
          </span>
          <button
            type="button"
            data-demo="icon"
            aria-label={t("openPopup")}
            aria-expanded={step !== "closed"}
            onClick={() => {
              setFill(3);
              setStep(step === "closed" ? "open" : "closed");
            }}
            className={cn(
              "state-layer relative flex size-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring",
              step === "closed" && !play.active && "extension-hint",
            )}
          >
            <Logo variant="symbol" className="h-5" />
          </button>
        </div>
        {/* The job page itself: just enough to recognise one. */}
        <div aria-hidden className="grid gap-3 p-5 sm:p-6">
          <span className="text-xl font-semibold">{demo("role")}</span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            {demo("company")}
            <MapPin className="size-3.5" />
            {demo("place")}
          </span>
          <span className="grid gap-2 pt-2">
            <span className="bg-muted h-2.5 w-11/12 rounded-full" />
            <span className="bg-muted h-2.5 w-10/12 rounded-full" />
            <span className="bg-muted h-2.5 w-8/12 rounded-full" />
            <span className="bg-muted h-2.5 w-9/12 rounded-full" />
          </span>
          <span className="border-input text-muted-foreground mt-2 w-fit rounded-full border px-5 py-1.5 text-sm">
            {t("apply")}
          </span>
        </div>
        {step !== "closed" && (
          <div className="extension-popup bg-popover absolute end-3 top-14 grid w-64 gap-3 rounded-xl p-4 shadow-lg">
            {step === "open" ? (
              <>
                <Logo variant="symbol" className="h-5" />
                <dl className="grid gap-2 text-sm">
                  {fields.map(([label, value], index) => (
                    <div key={label} className="grid gap-0.5">
                      <dt className="text-muted-foreground text-xs">{label}</dt>
                      <dd
                        className={cn(
                          "border-input truncate rounded-xs border px-2 py-1 transition-colors",
                          index === filled - 1 && play.playing && "bg-primary-container/50",
                        )}
                        dir="auto"
                      >
                        {/* Typed in from the page, one field after another. */}
                        <span className={cn("block", index < filled ? play.playing && "type-in" : "invisible")}>
                          {value}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <Button size="sm" data-demo="save" onClick={() => setStep("saved")}>
                  {t("save")}
                </Button>
              </>
            ) : (
              <div role="status" className="grid justify-items-start gap-3">
                <span className="saved-check bg-primary-container text-primary-container-foreground flex size-10 items-center justify-center rounded-full">
                  <Check className="size-5" aria-hidden />
                </span>
                <span className="font-medium">{t("saved")}</span>
                <Button variant="text" size="sm" data-demo="again" className="-ms-3" onClick={() => setStep("closed")}>
                  {t("again")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <DemoBar demo={play} hint={step === "closed" ? t("hint") : undefined} />
      <GuideCursor attach={attachPointer} />
    </div>
  );
}
