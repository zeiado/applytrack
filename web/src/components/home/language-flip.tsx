"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { CompanyInitial } from "@/components/applications/company-initial";
import { cn } from "@/lib/utils";

/** The preview's words in one language, read on the server from that language's messages. */
export type FlipCopy = {
  name: string;
  tagline: string;
  status: string;
  company: string;
  role: string;
  followUp: string;
};

/** A preview that flips between Arabic and English: the same card, written and laid out for
 * each language. `copy` has both; `start` is the page's language. */
export function LanguageFlip({
  copy,
  start,
  label,
}: {
  copy: Record<"ar" | "en", FlipCopy>;
  start: "ar" | "en";
  label: string;
}) {
  const [lang, setLang] = useState(start);
  const words = copy[lang];

  return (
    <div className="grid justify-items-start gap-5">
      {/* An M3 segmented button: the two languages, the chosen one tonal with a check. */}
      <div role="radiogroup" aria-label={label} className="border-input flex rounded-full border p-0.5">
        {(["ar", "en"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={lang === option}
            lang={option}
            onClick={() => setLang(option)}
            className={cn(
              "state-layer relative flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
              lang === option ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
            )}
          >
            {lang === option && <Check aria-hidden className="size-4" />}
            {copy[option].name}
          </button>
        ))}
      </div>
      {/* Remounts on each switch, so the new language plays its entrance. */}
      <div
        key={lang}
        lang={lang}
        dir={lang === "ar" ? "rtl" : "ltr"}
        className="language-flip bg-surface-container-high grid w-full max-w-md gap-4 rounded-2xl p-5"
      >
        <span className="text-2xl font-semibold rtl:font-bold">{words.tagline}</span>
        <div className="bg-muted grid gap-2.5 rounded-2xl p-3">
          <span className="px-1 text-sm font-semibold">{words.status}</span>
          <div className="bg-card grid gap-2 rounded-xl border p-3.5">
            <div className="flex items-center gap-2.5">
              <CompanyInitial company={words.company} locale={lang} />
              <div className="grid min-w-0">
                <span className="truncate font-semibold">{words.company}</span>
                <span className="text-muted-foreground truncate text-[0.8125rem]">{words.role}</span>
              </div>
            </div>
            <span className="bg-primary-container text-primary-container-foreground w-fit rounded-md px-2 py-0.5 text-xs font-medium">
              {words.followUp}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
