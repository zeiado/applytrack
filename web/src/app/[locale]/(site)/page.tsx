import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { DeletedNotice } from "@/components/deleted-notice";
import { ExtensionDemo } from "@/components/home/extension-demo";
import { type FlipCopy, LanguageFlip } from "@/components/home/language-flip";
import { HomeAiTeaser, HomeFaq, HomeFinale, HomeSection, MorningEmail } from "@/components/home/sections";
import { TryBoard } from "@/components/home/try-board";
import { HomeHero } from "@/components/home-hero";
import { HomeJourney } from "@/components/home-journey";
import type { Locale } from "@/i18n/routing";

/** The language preview's words, from that language's own messages. */
async function flipCopy(locale: Locale): Promise<FlipCopy> {
  const t = await getTranslations({ locale });
  return {
    name: t(`LanguageSwitcher.${locale}`),
    tagline: t("Home.tagline"),
    status: t("Status.applied"),
    company: t("Home.journey.demo.company"),
    role: t("Home.journey.demo.role"),
    followUp: t("Applications.card.followUpDue"),
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Home");
  const flip = { ar: await flipCopy("ar"), en: await flipCopy("en") };

  return (
    <>
      {/* Reads the URL, so it streams in; the rest of the page stays prerendered. */}
      <Suspense>
        <DeletedNotice />
      </Suspense>
      <HomeHero />
      <HomeJourney />
      <HomeSection id="try" title={t("try.title")} body={t("try.body")}>
        <TryBoard />
      </HomeSection>
      <HomeSection id="extension" title={t("extension.title")} body={t("extension.body")} flip>
        <ExtensionDemo />
      </HomeSection>
      <HomeSection id="email" title={t("email.title")} body={t("email.body")}>
        <MorningEmail />
      </HomeSection>
      <HomeSection id="languages" title={t("languages.title")} body={t("languages.body")} flip>
        <LanguageFlip copy={flip} start={locale as "ar" | "en"} label={t("languages.switchLabel")} />
      </HomeSection>
      <HomeAiTeaser />
      <HomeFaq />
      <HomeFinale />
    </>
  );
}
