"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

/** A panel that slides in from the inline end (the right, or the left in Arabic) over a faint
 * backdrop. Esc, the backdrop and the close button dismiss it. Built on Base UI's Dialog, so
 * focus moves into it and comes back when it closes. */
export const Sheet = Dialog.Root;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;

export function SheetContent({
  children,
  className,
  closeLabel,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  /** The close button's label, e.g. "Close". */
  closeLabel: string;
  /** Extra buttons in the top bar, before the close button. */
  actions?: React.ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="sheet-backdrop fixed inset-0 z-50 bg-black/25" />
      <Dialog.Popup
        className={cn(
          "sheet bg-card fixed inset-y-0 end-0 z-50 flex w-full max-w-xl flex-col shadow-2xl outline-none sm:rounded-s-2xl",
          className,
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-end gap-1 px-3">
          {actions}
          <Dialog.Close render={<Button variant="ghost" size="icon" aria-label={closeLabel} />}>
            <X aria-hidden />
          </Dialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10">{children}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}
