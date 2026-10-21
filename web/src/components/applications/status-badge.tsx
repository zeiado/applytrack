import { useTranslations } from "next-intl";

import type { ApplicationStatus } from "@/lib/applications/model";
import { cn } from "@/lib/utils";

// A color per stage, so the board and the list can be scanned at a glance. Text stays
// the foreground color; the dot carries the hue.
export const STATUS_DOT: Record<ApplicationStatus, string> = {
  wishlist: "bg-slate-400",
  applied: "bg-sky-500",
  screening: "bg-violet-500",
  interviewing: "bg-amber-500",
  offer: "bg-emerald-500",
  accepted: "bg-green-700",
  rejected: "bg-rose-500",
  withdrawn: "bg-zinc-400",
};

export function StatusDot({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_DOT[status], className)} />
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const t = useTranslations("Status");
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <StatusDot status={status} />
      {t(status)}
    </span>
  );
}
