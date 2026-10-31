"use client";

import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Autoplay } from "./use-autoplay";

/** The guide's pointer: an arrow with a small "Sekka" tag, like someone else's cursor in a
 * shared document. It only decorates (screen readers skip it); the demo's own buttons do the
 * work. Its tip sits at the box's top-left corner, so `translate(x, y)` puts the tip at x, y. */
export function GuideCursor({ attach }: { attach: Autoplay["attachPointer"] }) {
  const t = useTranslations("Home.demo");
  return (
    <div ref={attach} aria-hidden data-on="false" className="guide-cursor pointer-events-none absolute top-0 left-0 z-20">
      <svg viewBox="0 0 20 22" className="size-6 drop-shadow-md">
        <path
          d="M2 1.5 18 11l-7.2 1.6L7.2 20Z"
          className="fill-foreground stroke-background"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span className="bg-primary text-primary-foreground absolute top-5 left-4 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm">
        {t("cursorName")}
      </span>
    </div>
  );
}

/** Under a demo: what's going on, and Pause / Play while it plays itself. When it isn't
 * playing itself, just the demo's own hint. */
export function DemoBar({ demo, hint }: { demo: Pick<Autoplay, "active" | "paused" | "toggle">; hint?: string }) {
  const t = useTranslations("Home.demo");
  if (!demo.active) return hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-muted-foreground min-w-0 flex-1 text-sm">{t("watching")}</p>
      <button
        type="button"
        data-demo-control
        onClick={demo.toggle}
        className="state-layer border-input relative flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring"
      >
        {demo.paused ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}
        {demo.paused ? t("play") : t("pause")}
      </button>
    </div>
  );
}
