import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { ApplicationForm } from "@/components/applications/application-form";
import { DeleteApplication } from "@/components/applications/delete-application";
import type { Locale } from "@/i18n/routing";
import { updateApplication } from "@/lib/applications/actions";
import { getApplication } from "@/lib/applications/data";

type Props = PageProps<"/[locale]/applications/[id]/edit">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "ApplicationForm" });
  return { title: t("editTitle") };
}

// The application's id is only known per request, so the whole page streams in.
export default function EditApplicationPage({ params }: Props) {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <Suspense fallback={<div className="bg-muted h-96 animate-pulse rounded-xl" />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Props["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("ApplicationForm");
  const application = await getApplication(id);

  return (
    <>
      <h1 className="text-2xl font-bold">{t("editTitle")}</h1>
      <ApplicationForm action={updateApplication.bind(null, application.id)} application={application} />
      <hr />
      <div>
        <DeleteApplication id={application.id} />
      </div>
    </>
  );
}
