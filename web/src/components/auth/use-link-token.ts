"use client";

import { useSyncExternalStore } from "react";

let captured: string | null | undefined;

/** The token from an email link's fragment (#token=...). Emails put it there so it
 * never reaches a server log (ADR 0008). It's read once, then removed from the
 * address bar so it isn't left in the history.
 *
 * Returns undefined during server rendering, then the token or null. */
export function useLinkToken(): string | null | undefined {
  return useSyncExternalStore(subscribe, readToken, () => undefined);
}

function subscribe(): () => void {
  return () => {};
}

function readToken(): string | null {
  if (captured === undefined) {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    captured = token && token.length <= 256 ? token : null;
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }
  return captured;
}

/** For tests. */
export function resetLinkTokenForTests(): void {
  captured = undefined;
}
