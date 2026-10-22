import { useTranslations } from "next-intl";

import type { ApplicationStatus } from "@/lib/applications/model";
import { cn } from "@/lib/utils";

// A color per stage, so the board and the list can be scanned at a glance. Text stays
// the foreground color; the dot carries the hue.
export const STATUS_DOT: Record<ApplicationStatus, string> = {
  wishlist: "bg-status-wishlist",
  applied: "bg-status-applied",
  screening: "bg-status-screening",
  interviewing: "bg-status-interviewing",
  offer: "bg-status-offer",
  accepted: "bg-status-accepted",
  rejected: "bg-status-rejected",
  withdrawn: "bg-status-withdrawn",
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
