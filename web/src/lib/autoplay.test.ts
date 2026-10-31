import { afterEach, describe, expect, it, vi } from "vitest";

import { runLoop, wait } from "./autoplay";

afterEach(() => {
  vi.useRealTimers();
});

describe("wait", () => {
  it("resolves after the time, or rejects as soon as it's stopped", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const done = vi.fn();
    void wait(500, controller.signal).then(done);
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toHaveBeenCalled();

    const stopped = wait(500, controller.signal);
    controller.abort();
    await expect(stopped).rejects.toBeDefined();
  });
});

describe("runLoop", () => {
  it("repeats the script until stopped, then ends quietly", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let rounds = 0;
    const loop = runLoop(async (signal) => {
      rounds += 1;
      await wait(100, signal);
    }, controller.signal);

    await vi.advanceTimersByTimeAsync(350);
    expect(rounds).toBe(4);
    controller.abort();
    await expect(loop).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(1000);
    expect(rounds).toBe(4);
  });
});
