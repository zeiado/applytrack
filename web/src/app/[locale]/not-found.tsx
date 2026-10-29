import { useTranslations } from "next-intl";

import { RoadBackdrop } from "@/components/brand/road-backdrop";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <RoadBackdrop />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("home")}
      </Link>
    </main>
  );
}
