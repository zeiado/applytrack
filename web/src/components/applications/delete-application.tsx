"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FormError } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { deleteApplication } from "@/lib/applications/actions";
import type { ActionError } from "@/lib/auth/errors";

/** Asks once more on the page itself (no browser dialog) before deleting. */
export function DeleteApplication({ id }: { id: string }) {
  const t = useTranslations("ApplicationForm");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ActionError>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="destructive" className="h-10" onClick={() => setConfirming(true)}>
        {t("delete")}
      </Button>
    );
  }
  return (
    <div className="border-destructive/30 grid gap-3 rounded-lg border p-4" role="alertdialog" aria-labelledby="delete-warning">
      <p id="delete-warning" className="text-sm">
        {t("deleteWarning")}
      </p>
      <FormError error={error} />
      <div className="flex flex-wrap gap-3">
        <Button
          variant="destructive"
          className="h-10"
          disabled={pending}
          autoFocus
          onClick={() =>
            startTransition(async () => {
              // Redirects to the board on success.
              const result = await deleteApplication(id);
              setError(result?.error);
            })
          }
        >
          {t("deleteConfirm")}
        </Button>
        <Button variant="ghost" className="h-10" onClick={() => setConfirming(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
