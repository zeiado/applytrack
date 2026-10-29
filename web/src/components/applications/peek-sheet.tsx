"use client";

import { Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/navigation";

/** The board's side panel for one application (`?open=<id>`), Notion style: it slides in
 * next to the board, Esc or the backdrop closes it (back to `closeHref`), and "Open as page"
 * goes to the application's own page. */
export function PeekSheet({ id, closeHref, children }: { id: string; closeHref: string; children: React.ReactNode }) {
  const t = useTranslations("Peek");
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        router.push(closeHref, { scroll: false });
      }}
    >
      <SheetContent
        closeLabel={t("close")}
        actions={
          <Link href={`/applications/${id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} data-icon="inline-start">
            <Maximize2 aria-hidden />
            {t("openPage")}
          </Link>
        }
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** The panel's h1, which also names the dialog for screen readers. */
export function PeekTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <SheetTitle render={<h1 className={className} />}>{children}</SheetTitle>;
}
