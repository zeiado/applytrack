// "Install the app". Chrome on Android (and desktop) fires `beforeinstallprompt` once,
// early, on whatever page is open; it's kept here so the settings page can offer an
// Install button later. iOS has no such event: people add it from Safari's Share menu.

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

/** Starts listening; call once, as early as possible. Returns a cleanup function. */
export function captureInstallPrompt(): () => void {
  const onPrompt = (event: Event) => {
    event.preventDefault(); // We show our own button instead of the browser's banner.
    deferred = event as InstallPromptEvent;
    changed();
  };
  const onInstalled = () => {
    deferred = null;
    changed();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

/** Shows the browser's install dialog. The event can only be used once. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  changed();
  return outcome === "accepted";
}

export type InstallMode = "installed" | "prompt" | "ios" | "manual";

/** How this device can install the app, given whether an install prompt is waiting. */
export function installMode({
  standalone,
  canPrompt,
  userAgent,
  maxTouchPoints,
}: {
  standalone: boolean;
  canPrompt: boolean;
  userAgent: string;
  maxTouchPoints: number;
}): InstallMode {
  if (standalone) return "installed";
  if (canPrompt) return "prompt";
  // iPadOS reports itself as a Mac; touch points give it away.
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios ? "ios" : "manual";
}
