"use client";

import { useLocale } from "next-intl";
import { useLayoutEffect } from "react";

import { applyTheme, readTheme } from "@/lib/theme/theme";

/** Switching language re-renders <html> with its own class and style, which drops the
 * theme the script in <head> set. This puts it back before the browser paints. */
export function ThemeSync() {
  const locale = useLocale();
  useLayoutEffect(() => applyTheme(readTheme()), [locale]);
  return null;
}
