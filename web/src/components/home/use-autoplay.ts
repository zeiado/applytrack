"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { runLoop, wait } from "@/lib/autoplay";
import { motionOk } from "@/lib/motion";

/** "playing" and "paused" are the visitor's Pause button; "handed" means they touched the
 * demo and it's theirs now (the autoplay never comes back). */
type Mode = "playing" | "paused" | "handed";

/** What a demo's script can do with the guide cursor. Targets are `data-demo` names. */
export type Cursor = {
  /** Shows the cursor near the bottom middle of the demo. */
  home(signal: AbortSignal): Promise<void>;
  /** Glides the cursor's tip to the middle of the target (anything carried comes along). */
  moveTo(target: string, signal: AbortSignal): Promise<void>;
  click(signal: AbortSignal): Promise<void>;
  /** Moves to the target, presses, and picks it up: it now follows the cursor. */
  grab(target: string, signal: AbortSignal): Promise<void>;
  /** Lets go. Returns what was carried, still where the cursor left it, for the script to
   * put in its new place (and clear its `transform`). */
  drop(): HTMLElement | null;
};

export type Autoplay = {
  /** Put on the demo's box (positioned) and on <GuideCursor>'s pointer. */
  attachRoot: (node: HTMLDivElement | null) => void;
  attachPointer: (node: HTMLDivElement | null) => void;
  /** Whether the demo plays itself at all (motion is welcome and the visitor hasn't taken over). */
  active: boolean;
  /** Whether it's moving right now (on screen, tab visible, not paused). */
  playing: boolean;
  paused: boolean;
  toggle(): void;
};

const MOVE_MS = 750;
const noSubscribe = () => () => {};

/**
 * Plays a demo by itself, with a guide cursor, over and over: only while it's on screen,
 * the tab is visible and motion is welcome. Pause stops it where it is (Play starts the
 * script again); the visitor's first click or key press inside it stops it for good, so it's
 * theirs to use. `onStop` tidies up state a script may leave half done.
 */
export function useAutoplay(script: (cursor: Cursor, signal: AbortSignal) => Promise<void>, onStop?: () => void): Autoplay {
  const [root, attachRoot] = useState<HTMLDivElement | null>(null);
  const [pointer, attachPointer] = useState<HTMLDivElement | null>(null);
  const motion = useSyncExternalStore(noSubscribe, motionOk, () => false);
  const [mode, setMode] = useState<Mode>("playing");
  const [seen, setSeen] = useState(false);
  const latest = useRef({ script, onStop });
  useEffect(() => {
    latest.current = { script, onStop };
  });

  const active = motion && mode !== "handed";
  const playing = active && mode === "playing" && seen;

  // On screen (at least half of it) and the tab in front.
  useEffect(() => {
    const node = root;
    if (!active || !node || typeof IntersectionObserver === "undefined") return;
    let inView = false;
    const update = () => setSeen(inView && document.visibilityState === "visible");
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry?.isIntersecting ?? false;
        update();
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [active, root]);

  // The visitor's first touch (outside the Pause button) hands the demo over.
  useEffect(() => {
    const node = root;
    if (!active || !node) return;
    const takeOver = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-demo-control]")) return;
      setMode("handed");
    };
    node.addEventListener("pointerdown", takeOver);
    node.addEventListener("keydown", takeOver);
    return () => {
      node.removeEventListener("pointerdown", takeOver);
      node.removeEventListener("keydown", takeOver);
    };
  }, [active, root]);

  useEffect(() => {
    if (!playing || !root || !pointer) return;
    const cursor = makeCursor(root, pointer);
    const controller = new AbortController();
    void runLoop((signal) => latest.current.script(cursor, signal), controller.signal);
    return () => {
      controller.abort();
      cursor.hide();
      latest.current.onStop?.();
    };
  }, [playing, root, pointer]);

  return {
    attachRoot,
    attachPointer,
    active,
    playing,
    paused: mode === "paused",
    toggle: () => setMode((now) => (now === "paused" ? "playing" : "paused")),
  };
}

/** The cursor works on the DOM directly (a transform per move), so moving it re-renders nothing. */
function makeCursor(root: HTMLElement, pointer: HTMLElement): Cursor & { hide(): void } {
  let x = 0;
  let y = 0;
  let carried: { el: HTMLElement; x: number; y: number } | null = null;

  const place = (nextX: number, nextY: number) => {
    x = nextX;
    y = nextY;
    pointer.style.transform = `translate(${x}px, ${y}px)`;
    pointer.dataset.on = "true";
    if (carried) carried.el.style.transform = `translate(${x - carried.x}px, ${y - carried.y}px) rotate(-2deg)`;
  };
  const find = (target: string) => {
    const el = root.querySelector<HTMLElement>(`[data-demo="${target}"]`);
    if (!el) throw new Error(`Demo target "${target}" isn't on the page`);
    return el;
  };
  const pulse = (name: string) => {
    pointer.classList.remove(name);
    void pointer.offsetWidth; // restart the animation
    pointer.classList.add(name);
  };

  const cursor = {
    async home(signal: AbortSignal) {
      place(root.clientWidth / 2, root.clientHeight - 32);
      await wait(500, signal);
    },
    async moveTo(target: string, signal: AbortSignal) {
      const box = root.getBoundingClientRect();
      const rect = find(target).getBoundingClientRect();
      place(rect.left - box.left + rect.width / 2, rect.top - box.top + rect.height / 2);
      await wait(MOVE_MS, signal);
    },
    async click(signal: AbortSignal) {
      pulse("guide-click");
      await wait(300, signal);
    },
    async grab(target: string, signal: AbortSignal) {
      await cursor.moveTo(target, signal);
      pointer.classList.add("guide-press");
      const el = find(target);
      el.classList.add("card-lifted");
      carried = { el, x, y };
      await wait(250, signal);
    },
    drop() {
      pointer.classList.remove("guide-press");
      const el = carried?.el ?? null;
      el?.classList.remove("card-lifted");
      carried = null;
      return el;
    },
    hide() {
      const el = cursor.drop();
      if (el) el.style.transform = "";
      pointer.dataset.on = "false";
    },
  };
  return cursor;
}
