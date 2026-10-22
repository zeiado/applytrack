import { cn } from "@/lib/utils";

/** The company's first letter in a small teal tile, so cards are easy to tell apart.
 * Decorative: the company name is always next to it. */
export function CompanyInitial({ company, locale, className }: { company: string; locale: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary/10 text-primary flex size-[34px] shrink-0 items-center justify-center rounded-lg font-semibold",
        className,
      )}
    >
      {(Array.from(company.trim())[0] ?? "?").toLocaleUpperCase(locale)}
    </span>
  );
}
