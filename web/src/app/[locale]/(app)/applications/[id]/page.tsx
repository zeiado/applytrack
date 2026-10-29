import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { ApplicationView } from "@/components/applications/application-view";
import { Link } from "@/i18n/navigation";
import { direction, type Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/applications/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Applications" });
  return { title: t("title") };
}

// The application's id is only known per request, so the whole page streams in.
export default function ApplicationPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="bg-muted mx-auto h-96 w-full max-w-3xl animate-pulse rounded-xl" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Props["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Detail");
  const Back = direction(locale as Locale) === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <Link href="/applications" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <Back aria-hidden className="size-4" />
        {t("back")}
      </Link>
      <ApplicationView id={id} variant="page" />
    </div>
  );
}
