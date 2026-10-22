"use client";

import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/brand";
import { canPromptInstall, installMode, promptInstall, subscribeInstallPrompt } from "@/lib/pwa/install";

const STANDALONE = "(display-mode: standalone)";

function subscribe(listener: () => void) {
  const media = window.matchMedia(STANDALONE);
  media.addEventListener("change", listener);
  const stop = subscribeInstallPrompt(listener);
  return () => {
    media.removeEventListener("change", listener);
    stop();
  };
}

function currentMode() {
  return installMode({
    standalone:
      window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    canPrompt: canPromptInstall(),
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

/** "Add to Home screen": a button where the browser allows one (Android, desktop
 * Chrome), Safari's steps on iPhone and iPad, and a pointer to the menu elsewhere. */
export function InstallApp() {
  const t = useTranslations("Settings.app");
  // The server can't know the device: it renders the general hint, then the browser fills in.
  const mode = useSyncExternalStore(subscribe, currentMode, () => "manual" as const);
  const [pending, startTransition] = useTransition();

  if (mode === "installed") {
    return <p className="text-muted-foreground text-sm">{t("installed")}</p>;
  }
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">{t("body", { app: APP_NAME })}</p>
      {mode === "prompt" && (
        <Button
          type="button"
          className="h-10 w-fit gap-1.5 px-5"
          disabled={pending}
          onClick={() => startTransition(async () => void (await promptInstall()))}
        >
          <Download aria-hidden />
          {t("install")}
        </Button>
      )}
      {mode === "ios" && (
        <p className="bg-muted flex items-center gap-2 rounded-lg p-3 text-sm">
          <Share aria-hidden className="size-4 shrink-0" />
          {t("ios")}
        </p>
      )}
      {mode === "manual" && <p className="bg-muted rounded-lg p-3 text-sm">{t("manual")}</p>}
    </div>
  );
}
