/** Waits `ms`, or rejects straight away when `signal` aborts (so a stopped demo stops mid-step). */
export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    function stop() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** Plays `script` again and again until `signal` aborts. Stopping is quiet; any other error
 * ends the loop and is reported, so a broken demo doesn't spin. */
export async function runLoop(script: (signal: AbortSignal) => Promise<void>, signal: AbortSignal): Promise<void> {
  try {
    while (!signal.aborted) await script(signal);
  } catch (error) {
    if (!signal.aborted) console.error(error);
  }
}
