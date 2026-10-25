import { Download, MessageSquare, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { InstallApp } from "@/components/pwa/install-app";
import { DeleteAccount, PreferencesForm, SetPassword } from "@/components/settings/settings-forms";
import { ThemePicker } from "@/components/settings/theme-picker";
import { buttonVariants } from "@/components/ui/button";
import { FEEDBACK_URL } from "@/config/brand";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { allTimeZones, SUGGESTED_TIME_ZONES, timeZoneLabel } from "@/lib/account/time-zones";
import { getCurrentUser } from "@/lib/auth/session";
import { isolate } from "@/lib/bidi";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Settings" });
  return { title: t("title") };
}

export default async function SettingsPage({ params }: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Settings");

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {/* The account is per request: the sections stream in. */}
      <Suspense fallback={<div className="bg-muted h-96 animate-pulse rounded-xl" />}>
        <Sections locale={locale as Locale} />
      </Suspense>
    </div>
  );
}

async function Sections({ locale }: { locale: Locale }) {
  const t = await getTranslations("Settings");
  const tLegal = await getTranslations("Legal");
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/settings", locale });

  const now = new Date();
  const zone = (value: string) => ({ value, label: timeZoneLabel(value, now) });
  const methods = user.sign_in_methods;

  return (
    <>
      <Section title={t("account.title")}>
        <dl className="bg-card grid gap-3 rounded-lg border p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("account.email")}</dt>
            <dd className="wrap-anywhere">
              {isolate(user.email)}{" "}
              <span className="text-muted-foreground">
                ({user.email_verified ? t("account.verified") : t("account.notVerified")})
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{t("account.signIn")}</dt>
            <dd>{methods.map((method) => t(`account.${method}`)).join(" · ")}</dd>
          </div>
        </dl>
      </Section>

      <Section title={t("profile.title")}>
        <p className="text-muted-foreground text-sm">{t("profile.body")}</p>
        <Link href="/profile" className={buttonVariants({ variant: "outline", className: "h-10 w-fit gap-1.5" })}>
          <UserRound aria-hidden />
          {t("profile.edit")}
        </Link>
      </Section>

      <Section title={t("preferences.title")}>
        <PreferencesForm
          user={user}
          suggested={SUGGESTED_TIME_ZONES.map(zone)}
          zones={allTimeZones().map(zone)}
        />
      </Section>

      <Section title={t("theme.title")}>
        <ThemePicker />
      </Section>

      <Section title={t("password.title")}>
        {methods.includes("password") ? (
          <p className="text-muted-foreground text-sm">{t("password.change")}</p>
        ) : (
          <SetPassword />
        )}
      </Section>

      <Section title={t("app.title")}>
        <InstallApp />
      </Section>

      {FEEDBACK_URL && (
        <Section title={t("feedback.title")}>
          <p className="text-muted-foreground text-sm">{t("feedback.body")}</p>
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", className: "h-10 w-fit gap-1.5" })}
          >
            <MessageSquare aria-hidden />
            {t("feedback.action")}
          </a>
        </Section>
      )}

      <Section title={t("data.title")}>
        <p className="text-muted-foreground text-sm">{t("data.body")}</p>
        {/* A plain link: the route sends the file, so the browser downloads it. */}
        <a
          href="/api/account/export"
          download
          className={buttonVariants({ variant: "outline", className: "h-10 w-fit gap-1.5" })}
        >
          <Download aria-hidden />
          {t("data.download")}
        </a>
      </Section>

      <Section title={t("delete.title")} danger>
        <p className="text-muted-foreground text-sm">{t("delete.body")}</p>
        <DeleteAccount hasPassword={methods.includes("password")} />
      </Section>

      <nav aria-label={tLegal("nav")} className="text-muted-foreground flex gap-5 border-t pt-6 text-sm">
        <Link href="/privacy" className="hover:text-foreground hover:underline">
          {tLegal("privacy")}
        </Link>
        <Link href="/terms" className="hover:text-foreground hover:underline">
          {tLegal("terms")}
        </Link>
      </nav>
    </>
  );
}

function Section({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className={danger ? "text-destructive text-lg font-semibold" : "text-lg font-semibold"}>{title}</h2>
      {children}
    </section>
  );
}
