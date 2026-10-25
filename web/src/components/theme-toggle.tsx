"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { saveTheme } from "@/lib/theme/theme";

/** One tap between light and dark, in the header of every page. Which icon shows comes
 * from the `.dark` class (CSS only), so it's right before React loads. Settings still
 * offers "System" to follow the device again. */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  return (
    <button
      type="button"
      onClick={() => saveTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
      className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-9 items-center justify-center rounded-lg"
    >
      <Moon aria-hidden className="size-4 dark:hidden" />
      <Sun aria-hidden className="hidden size-4 dark:block" />
      <span className="sr-only dark:hidden">{t("toDark")}</span>
      <span className="sr-only hidden dark:inline">{t("toLight")}</span>
    </button>
  );
}
