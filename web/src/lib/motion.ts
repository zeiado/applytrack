import { flushSync } from "react-dom";

/** Whether the visitor is fine with motion (false on the server, or when they asked for less). */
export function motionOk(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches === true;
}

/** Runs a state change inside the browser's view transition when it has one and motion is
 * welcome, so elements with a view-transition-name glide to their new place. Otherwise it
 * just runs the change. */
export function withTransition(update: () => void): void {
  if (!motionOk() || !("startViewTransition" in document)) return update();
  document.startViewTransition(() => flushSync(update));
}
