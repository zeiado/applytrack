import { Check, ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { RoadLine } from "@/components/brand/road";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { hideGuide } from "@/lib/onboarding/actions";
import type { GuideStep } from "@/lib/onboarding/guide";
import { cn } from "@/lib/utils";

/** The first-run guide on the board: a few steps, each ticked off when it's done. */
export async function GettingStarted({ steps }: { steps: GuideStep[] }) {
  const t = await getTranslations("Guide");
  const done = steps.filter((step) => step.done).length;
  // The first step not done yet gets the filled button.
  const next = steps.find((step) => !step.done)?.key;

  return (
    <section aria-labelledby="guide-title" className="bg-card grid gap-5 rounded-2xl border p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <div className="grid flex-1 gap-2">
          <RoadLine className="max-w-40" />
          <h2 id="guide-title" className="text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("progress", { done, total: steps.length })}</p>
        </div>
        <form action={hideGuide}>
          <button type="submit" className="text-muted-foreground hover:text-foreground text-sm hover:underline">
            {t("hide")}
          </button>
        </form>
      </header>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={cn("grid content-start gap-3 rounded-xl border p-4", step.done && "bg-muted/50")}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  step.done ? "bg-primary text-primary-foreground" : "border-primary text-primary border-2",
                )}
              >
                {step.done ? <Check className="size-4" /> : index + 1}
              </span>
              <h3 className={cn("font-semibold", step.done && "text-muted-foreground line-through")}>
                {t(`steps.${step.key}.title`)}
              </h3>
              {step.done && <span className="sr-only">{t("done")}</span>}
            </div>
            <p className="text-muted-foreground text-sm">{t(`steps.${step.key}.body`)}</p>
            {!step.done &&
              (step.key === "extension" ? (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    variant: next === step.key ? "default" : "outline",
                    className: "h-10 w-fit gap-1.5",
                  })}
                >
                  {t(`steps.${step.key}.action`)}
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              ) : (
                <Link
                  href={step.href}
                  className={buttonVariants({
                    variant: next === step.key ? "default" : "outline",
                    className: "h-10 w-fit",
                  })}
                >
                  {t(`steps.${step.key}.action`)}
                </Link>
              ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
