import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { RoadLine } from "@/components/brand/road";
import { CONTACT_EMAIL, FEEDBACK_URL } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const VALUES = ["arabic", "calm", "data"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Site.about" });
  return { title: t("title"), description: t("story.first") };
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Site.about");

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-16 px-4 pt-12 pb-24 sm:pt-20">
      <header className="grid max-w-2xl gap-6">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl rtl:font-bold">{t("heading")}</h1>
        <RoadLine className="max-w-56" />
        <p className="text-lg leading-8 text-pretty">{t("story.first")}</p>
        <p className="text-muted-foreground text-lg leading-8 text-pretty">{t("story.second")}</p>
      </header>

      <div className="grid gap-10 border-t pt-12 md:grid-cols-3 md:gap-12">
        {VALUES.map((key) => (
          <section key={key} aria-labelledby={`${key}-title`} className="grid content-start justify-items-start gap-3">
            <h2 id={`${key}-title`} className="text-xl font-semibold">
              {t(`${key}.title`)}
            </h2>
            <p className="text-muted-foreground text-pretty">{t(`${key}.body`)}</p>
            {key === "data" && (
              <Link href="/privacy" className="text-primary font-medium underline-offset-4 hover:underline">
                {t("data.link")}
              </Link>
            )}
          </section>
        ))}
      </div>

      <section id="contact" aria-labelledby="contact-title" className="grid scroll-mt-24 gap-3 border-t pt-12">
        <h2 id="contact-title" className="text-xl font-semibold">
          {t("contact.title")}
        </h2>
        <p className="text-muted-foreground">
          {CONTACT_EMAIL ? (
            t.rich("contact.email", {
              address: CONTACT_EMAIL,
              email: (chunks) => (
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline" dir="ltr">
                  {chunks}
                </a>
              ),
            })
          ) : FEEDBACK_URL ? (
            <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {t("contact.noEmail")}
            </a>
          ) : (
            t("contact.noEmail")
          )}
        </p>
      </section>
    </div>
  );
}
