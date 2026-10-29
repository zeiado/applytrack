import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import {
  BoardPreview,
  CvPreview,
  FollowUpPreview,
  InterviewsPreview,
  SavePreview,
  StatsPreview,
} from "@/components/site/previews";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Each section: its anchor (the footer links to #extension) and the screen it shows. Its points
// are the entries under Site.features.sections.<key>.points, in order.
const SECTIONS = [
  { key: "board", id: "board", Preview: BoardPreview },
  { key: "followUps", id: "follow-ups", Preview: FollowUpPreview },
  { key: "details", id: "details", Preview: InterviewsPreview },
  { key: "stats", id: "stats", Preview: StatsPreview },
  { key: "extension", id: "extension", Preview: SavePreview },
  { key: "cvs", id: "cvs", Preview: CvPreview },
] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/features">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Site.features" });
  return { title: t("title"), description: t("intro") };
}

export default async function FeaturesPage({ params }: PageProps<"/[locale]/features">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Site.features");
  const tHome = await getTranslations("Home");
  const { sections } = (await getMessages()).Site.features;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-12 pb-24 sm:pt-20">
      <header className="grid max-w-2xl gap-4 pb-16">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl rtl:font-bold">{t("heading")}</h1>
        <p className="text-muted-foreground text-lg text-pretty">{t("intro")}</p>
      </header>

      {SECTIONS.map(({ key, id, Preview }, index) => (
        <section
          key={key}
          id={id}
          aria-labelledby={`${id}-title`}
          className="grid scroll-mt-24 items-center gap-8 border-t py-14 md:grid-cols-2 md:gap-16 lg:gap-24"
        >
          {/* Text and picture swap sides on every other row, from md up. */}
          <div className={cn("grid content-start gap-5", index % 2 === 1 && "md:order-2")}>
            <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl rtl:font-bold">
              {t(`sections.${key}.title`)}
            </h2>
            <ul className="grid gap-3">
              {Object.entries(sections[key].points).map(([point, text]) => (
                <li key={point} className="flex gap-3">
                  <Check aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
                  <span className="text-pretty">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div aria-hidden className="w-full max-w-md select-none md:max-w-lg md:justify-self-center">
            <Preview />
          </div>
        </section>
      ))}

      <div className="grid gap-10 border-t py-14 md:grid-cols-2 md:gap-16 lg:gap-24">
        <section aria-labelledby="languages-title" className="grid content-start gap-3">
          <h2 id="languages-title" className="text-xl font-semibold">
            {t("more.languages.title")}
          </h2>
          <p className="text-muted-foreground max-w-md text-pretty">{t("more.languages.body")}</p>
        </section>
        <section aria-labelledby="data-title" className="grid content-start justify-items-start gap-3">
          <h2 id="data-title" className="text-xl font-semibold">
            {t("more.data.title")}
          </h2>
          <p className="text-muted-foreground max-w-md text-pretty">{t("more.data.body")}</p>
          <Link href="/privacy" className="text-primary font-medium underline-offset-4 hover:underline">
            {t("more.data.link")}
          </Link>
        </section>
      </div>

      <div className="grid justify-items-start gap-6 border-t pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl rtl:font-bold">{t("cta")}</h2>
        <Link href="/register" className={buttonVariants({ size: "xl" })}>
          {tHome("getStarted")}
        </Link>
      </div>
    </div>
  );
}
