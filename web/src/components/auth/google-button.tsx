"use client";

import Script from "next/script";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useRef, useState, useTransition } from "react";

import { signInWithGoogle } from "@/lib/auth/actions";
import type { ActionError } from "@/lib/auth/errors";

import { FormError, OrDivider } from "./form-parts";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type CredentialResponse = { credential: string };
type GoogleIdentity = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        ux_mode?: "popup" | "redirect";
        context?: "signin" | "signup" | "use";
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          theme?: "outline" | "filled_blue";
          size?: "large";
          text?: "continue_with" | "signin_with" | "signup_with";
          shape?: "rectangular" | "pill";
          width?: number;
          locale?: string;
        },
      ): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

/** Google's own "Continue with Google" button (Google Identity Services). Google
 * hands us an ID token, which the server exchanges with the API for a session. */
export function GoogleButton({ next }: { next: string | null }) {
  const locale = useLocale();
  const t = useTranslations("Auth.google");
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<ActionError>();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const render = useCallback(() => {
    const google = window.google;
    if (!google || !container.current || !CLIENT_ID) return;
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      ux_mode: "popup",
      callback: ({ credential }) =>
        startTransition(async () => {
          // Redirects on success; only an error comes back.
          const result = await signInWithGoogle(credential, next);
          setError(result?.error);
        }),
    });
    google.accounts.id.renderButton(container.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: container.current.offsetWidth || 320,
      locale,
    });
  }, [locale, next]);

  if (!CLIENT_ID) return null;

  return (
    <div className="grid gap-4">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={render}
        onError={() => setFailed(true)}
      />
      <div
        ref={container}
        className="flex min-h-10 justify-center"
        aria-busy={pending}
        style={pending ? { opacity: 0.5, pointerEvents: "none" } : undefined}
      />
      {failed && <p className="text-muted-foreground text-sm">{t("unavailable")}</p>}
      <FormError error={error} />
      <OrDivider />
    </div>
  );
}
