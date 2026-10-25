import { getTranslations } from "next-intl/server";

import { CONTACT_EMAIL } from "@/config/brand";
import type { Block, LegalDoc } from "@/content/legal/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** The privacy policy or the terms: a title, the date, a list of sections, the text. */
export async function LegalPage({ doc, updated, locale }: { doc: LegalDoc; updated: string; locale: Locale }) {
  const t = await getTranslations("Legal");
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(updated));

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-8 px-4 pt-6 pb-16 sm:pt-12">
      <header className="grid gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{doc.title}</h1>
        <p className="text-muted-foreground text-sm">{t("updated", { date })}</p>
        <p className="text-lg leading-8">{doc.intro}</p>
      </header>

      <nav aria-label={t("contents")} className="bg-card rounded-2xl border p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("contents")}</h2>
        <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
          {doc.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-primary hover:underline">
                {section.title}
              </a>
            </li>
          ))}
          <li>
            <a href="#contact" className="text-primary hover:underline">
              {t("contactTitle")}
            </a>
          </li>
        </ol>
      </nav>

      {doc.sections.map((section) => (
        <section key={section.id} id={section.id} className="grid scroll-mt-6 gap-3">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.body.map((block, index) => (
            <Body key={index} block={block} />
          ))}
        </section>
      ))}

      <section id="contact" className="grid scroll-mt-6 gap-3">
        <h2 className="text-xl font-semibold">{t("contactTitle")}</h2>
        <p className="leading-7">
          {CONTACT_EMAIL ? (
            t.rich("contact", {
              address: CONTACT_EMAIL,
              email: (chunks) => (
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline" dir="ltr">
                  {chunks}
                </a>
              ),
            })
          ) : (
            <Link href="/settings" className="text-primary hover:underline">
              {t("contactNoEmail")}
            </Link>
          )}
        </p>
      </section>
    </article>
  );
}

function Body({ block }: { block: Block }) {
  if (typeof block === "string") return <p className="leading-7">{block}</p>;
  return (
    <ul className="grid list-disc gap-2 ps-5 leading-7 marker:text-primary">
      {block.list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
