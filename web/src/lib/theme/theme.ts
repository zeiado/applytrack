// Light, dark, or the device's setting. Kept in this browser (localStorage) and applied
// by a small script in <head> before the page paints, so there's no flash of the wrong
// theme and pages can still be prerendered.
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_KEY = "theme";

export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return THEMES.find((theme) => theme === value) ?? "system";
  } catch {
    return "system";
  }
}

/** Puts `.dark` on <html> (the palette in globals.css) for dark, or for system on a dark device. */
export function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

const listeners = new Set<() => void>();

/** For useSyncExternalStore: told when this tab or another one changes the theme. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function saveTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice lasts until the page is closed.
  }
  applyTheme(theme);
  for (const listener of listeners) listener();
}

/** The same as readTheme + applyTheme, as text for an inline script in <head>. It also
 * follows the device when it switches between light and dark while the page is open. */
export const THEME_SCRIPT = `(function(){function a(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}a();matchMedia("(prefers-color-scheme: dark)").addEventListener("change",a)})()`;
