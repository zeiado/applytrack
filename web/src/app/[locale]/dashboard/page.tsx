import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { VerifyBanner } from "@/components/auth/verify-banner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { logOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { isolate } from "@/lib/bidi";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Dashboard" });
  return { title: t("title") };
}

// The applications board replaces this page's content in #65.
export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Dashboard");

  return (
    <>
      <SiteHeader>
        <form action={logOut}>
          <Button type="submit" variant="ghost" size="sm">
            {t("logOut")}
          </Button>
        </form>
      </SiteHeader>
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
        {/* The session is per request, so it streams in after the page frame. */}
        <Suspense fallback={<div className="bg-muted h-24 animate-pulse rounded-xl" />}>
          <Welcome />
        </Suspense>
      </main>
    </>
  );
}

async function Welcome() {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/dashboard", locale: await getLocale() });
  const t = await getTranslations("Dashboard");

  return (
    <>
      {!user.email_verified && <VerifyBanner email={user.email} />}
      <section className="grid gap-2">
        <h1 className="text-2xl font-bold wrap-anywhere">
          {t("welcome", { email: isolate(user.email) })}
        </h1>
        <p className="text-muted-foreground">{t("comingSoon")}</p>
      </section>
    </>
  );
}
