import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";

/** The road motif as a thin, decorative track: a teal dot where you start (the reading
 * start) and the amber "yes" dot where it ends. Arabic gets its own coordinates rather
 * than a CSS flip (see brand/REDESIGN.md). */
export function RoadLine({ className }: { className?: string }) {
  const rtl = useLocale() === "ar";
  const [start, end] = rtl ? [330, 12] : [12, 330];
  return (
    <svg aria-hidden viewBox="0 0 342 24" className={cn("h-6 w-full max-w-xs", className)}>
      <path d="M26 12 H316" className="stroke-primary/25" strokeWidth={3} strokeLinecap="round" />
      <path d="M26 12 H316" className="stroke-background" strokeWidth={1} strokeDasharray="6 6" />
      <circle cx={start} cy={12} r={6} className="fill-primary" />
      <circle cx={end} cy={12} r={7} className="fill-yes" />
    </svg>
  );
}
