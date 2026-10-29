"use client";

import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

/** Short messages after an action ("Moved to Interviewing", "Saved"), M3 snackbar style: the
 * inverse surface, at the bottom (above the phone nav bar), with an optional action such as
 * Undo. Screen readers hear them politely. Wrap the signed-in app in <ToastProvider>. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={6000} limit={3}>
      {children}
      <Toaster />
    </Toast.Provider>
  );
}

function Toaster() {
  const { toasts } = Toast.useToastManager();
  const t = useTranslations("Toast");
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto grid max-w-md gap-2 md:inset-x-auto md:end-6 md:bottom-6 md:w-96">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="toast bg-inverse-surface text-inverse-surface-foreground flex items-center gap-2 rounded-lg py-2 ps-4 pe-2 shadow-lg"
          >
            <Toast.Content className="min-w-0 flex-1 py-1.5">
              <Toast.Title className="text-sm font-medium" />
              <Toast.Description className="text-sm opacity-80" />
            </Toast.Content>
            {toast.actionProps && (
              <Toast.Action className="state-layer text-inverse-primary relative h-9 rounded-full px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-current" />
            )}
            <Toast.Close
              aria-label={t("close")}
              className="state-layer relative flex size-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-current"
            >
              <X aria-hidden className="size-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

/** add({ title, actionProps: { children: "Undo", onClick } }) shows a toast. */
export const useToast = Toast.useToastManager;
