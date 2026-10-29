import { FileText, MessagesSquare, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { FEEDBACK_URL } from "@/config/brand";
import type { Locale } from "@/i18n/routing";

const AI_ITEMS = [
  { key: "tailor", Icon: FileText },
  { key: "interview", Icon: MessagesSquare },
  { key: "profile", Icon: UserRound },
] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/roadmap">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Site.roadmap" });
  return { title: t("title"), description: t("intro") };
}

/** What's planned, without dates or prices: nothing here should need taking back. */
export default async function RoadmapPage({ params }: PageProps<"/[locale]/roadmap">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Site.roadmap");

  const soon = (
    <span className="bg-primary-container text-primary-container-foreground w-fit rounded-sm px-2.5 py-1 text-xs font-medium">
      {t("soon")}
    </span>
  );

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 pt-12 pb-24 sm:pt-20">
      <header className="grid max-w-2xl gap-4 pb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl rtl:font-bold">{t("heading")}</h1>
        <p className="text-muted-foreground text-lg text-pretty">{t("intro")}</p>
      </header>

      <section aria-labelledby="ai-title" className="bg-surface-container-high grid gap-6 rounded-2xl p-6 sm:p-10">
        <div className="grid justify-items-start gap-3">
          {soon}
          <h2 id="ai-title" className="text-3xl font-semibold tracking-tight rtl:font-bold">
            {t("ai.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-lg text-pretty">{t("ai.body")}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {AI_ITEMS.map(({ key, Icon }) => (
            <li key={key} className="bg-card grid content-start gap-3 rounded-xl p-5">
              <span className="bg-primary-container text-primary-container-foreground flex size-10 items-center justify-center rounded-lg">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="text-pretty">{t(`ai.items.${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["pro", "store"] as const).map((key) => (
          <section key={key} aria-labelledby={`${key}-title`} className="grid content-start gap-3 rounded-2xl border p-6">
            {soon}
            <h2 id={`${key}-title`} className="text-xl font-semibold">
              {t(`${key}.title`)}
            </h2>
            <p className="text-muted-foreground text-pretty">{t(`${key}.body`)}</p>
          </section>
        ))}
      </div>

      <section aria-labelledby="ideas-title" className="grid justify-items-start gap-3 border-t pt-10">
        <h2 id="ideas-title" className="text-xl font-semibold">
          {t("ideas.title")}
        </h2>
        <p className="text-muted-foreground">{t("ideas.body")}</p>
        {FEEDBACK_URL && (
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
            {t("ideas.action")}
          </a>
        )}
      </section>
    </div>
  );
}
