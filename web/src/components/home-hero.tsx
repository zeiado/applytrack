import { BellRing, ChartNoAxesColumn, KanbanSquare } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Big enough to tap comfortably on a phone.
const CTA = "h-11 px-6 text-base";

const FEATURES = [
  { key: "board", Icon: KanbanSquare },
  { key: "reminders", Icon: BellRing },
  { key: "insights", Icon: ChartNoAxesColumn },
] as const;

export function HomeHero() {
  const t = useTranslations("Home");

  return (
    <>
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {t("tagline")}
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">{t("intro")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }), CTA)}>
            {t("getStarted")}
          </Link>
          <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }), CTA)}>
            {t("logIn")}
          </Link>
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {FEATURES.map(({ key, Icon }) => (
          <div key={key} className="bg-card rounded-xl border p-5">
            <Icon className="text-primary mb-3 size-6" aria-hidden />
            <h2 className="mb-1 font-semibold">{t(`features.${key}.title`)}</h2>
            <p className="text-muted-foreground text-sm">{t(`features.${key}.body`)}</p>
          </div>
        ))}
      </section>
    </>
  );
}
