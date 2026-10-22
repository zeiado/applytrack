import { BellRing, ChartNoAxesColumn, KanbanSquare } from "lucide-react";
import { useTranslations } from "next-intl";

import { RoadIllustration } from "@/components/brand/road";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { STATUSES } from "@/lib/applications/model";
import { cn } from "@/lib/utils";

const FEATURES = [
  { key: "board", Icon: KanbanSquare },
  { key: "reminders", Icon: BellRing },
  { key: "insights", Icon: ChartNoAxesColumn },
] as const;

/** The road's five stops: wishlist through offer. */
const STOPS = STATUSES.slice(0, STATUSES.indexOf("offer") + 1);

export function HomeHero() {
  const t = useTranslations();

  return (
    <>
      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-12 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className="grid justify-items-start gap-6">
          <h1 className="text-5xl font-semibold tracking-tight text-balance lg:text-7xl rtl:font-bold">
            {t("Home.tagline")}
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty lg:text-xl">{t("Home.intro")}</p>
          {/* One clear way in; "Log in" lives in the header. */}
          <Link href="/register" className={cn(buttonVariants(), "h-14 rounded-2xl px-7 text-lg")}>
            {t("Home.getStarted")}
          </Link>
        </div>
        <RoadIllustration
          stages={STOPS.map((status) => t(`Status.${status}`))}
          yes={t("Home.road.yes")}
          label={t("Home.road.label")}
          className="mx-auto max-w-xl"
        />
      </section>
      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-20 sm:grid-cols-3">
        {FEATURES.map(({ key, Icon }) => (
          <div key={key} className="bg-card rounded-2xl border p-6">
            <Icon className="text-primary mb-3 size-6" aria-hidden />
            <h2 className="mb-1 font-semibold">{t(`Home.features.${key}.title`)}</h2>
            <p className="text-muted-foreground text-sm">{t(`Home.features.${key}.body`)}</p>
          </div>
        ))}
      </section>
    </>
  );
}
