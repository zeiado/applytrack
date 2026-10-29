import { useTranslations } from "next-intl";

import { BoardPreview, FollowUpPreview, OfferPreview, SavePreview } from "@/components/site/previews";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const STEPS = ["save", "track", "followUp", "yes"] as const;

/** The screen each step happens on. */
const PREVIEWS = { save: SavePreview, track: BoardPreview, followUp: FollowUpPreview, yes: OfferPreview };

/** Below the hero: the road keeps going down the page, one stop per step of a job search,
 * each next to a small, static copy of the screen it happens on. It ends at the amber "yes". */
export function HomeJourney() {
  const t = useTranslations("Home.journey");
  const tHome = useTranslations("Home");

  return (
    <section aria-labelledby="journey-title" className="mx-auto w-full max-w-7xl px-4 pb-24">
      <h2
        id="journey-title"
        className="mb-12 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl rtl:font-bold"
      >
        {t("title")}
      </h2>
      <ol>
        {STEPS.map((step, index) => {
          const last = index === STEPS.length - 1;
          const Preview = PREVIEWS[step];
          return (
            <li
              key={step}
              className="relative grid gap-5 ps-14 pb-16 last:pb-0 md:grid-cols-[minmax(0,26rem)_minmax(0,34rem)] md:gap-16 lg:gap-24"
            >
              {/* The road: a thick teal track with a dashed centre line, as in the hero. It runs
                  into the next stop, so the steps read as one road. */}
              {!last && (
                <span aria-hidden className="bg-primary absolute start-[13px] top-3 -bottom-3 w-3 rounded-full">
                  <span className="absolute inset-y-2 inset-x-0 mx-auto w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--background)_0_6px,transparent_6px_12px)]" />
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1 z-10 rounded-full",
                  last ? "bg-yes start-[3px] size-8" : "border-primary bg-background start-[5px] size-7 border-[6px]",
                )}
              />
              <div className="grid content-start gap-2 pt-1">
                <h3 className="text-xl font-semibold">{t(`steps.${step}.title`)}</h3>
                <p className="text-muted-foreground max-w-md text-pretty">{t(`steps.${step}.body`)}</p>
              </div>
              {/* A picture of the screen, so hidden from screen readers: the text says it all. */}
              <div aria-hidden className="max-w-md select-none md:max-w-none">
                <Preview />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-20 grid justify-items-start gap-6 border-t pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl rtl:font-bold">{t("cta")}</h2>
        <Link href="/register" className={buttonVariants({ size: "xl" })}>
          {tHome("getStarted")}
        </Link>
      </div>
    </section>
  );
}
