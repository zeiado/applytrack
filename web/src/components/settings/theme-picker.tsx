"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { readTheme, saveTheme, subscribeTheme, type Theme, THEMES } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

const ICONS = { system: Monitor, light: Sun, dark: Moon } satisfies Record<Theme, unknown>;

/** System, light or dark: applies at once and is remembered in this browser. */
export function ThemePicker() {
  const t = useTranslations("Settings.theme");
  // The choice lives in the browser: unknown (null) while rendering on the server.
  const theme = useSyncExternalStore<Theme | null>(subscribeTheme, readTheme, () => null);

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{t("title")}</legend>
      <div className="bg-muted inline-grid w-fit grid-cols-3 gap-1 rounded-lg p-1">
        {THEMES.map((option) => {
          const Icon = ICONS[option];
          return (
            <label
              key={option}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-ring",
                theme === option ? "bg-background shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={theme === option}
                onChange={() => saveTheme(option)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4" />
              {t(option)}
            </label>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">{t("hint")}</p>
    </fieldset>
  );
}
