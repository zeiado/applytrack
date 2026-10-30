"use client";

import { useEffect, useState } from "react";

import { motionOk } from "@/lib/motion";

/** A number that counts up from zero once, when the page opens ("8", "67%"). It always ends
 * on `value` exactly; text that isn't a plain number, or reduced motion, shows as it is. */
export function CountUp({ value, duration = 700 }: { value: string; duration?: number }) {
  const match = /^(\d+)(%?)$/.exec(value);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!match || !motionOk()) return;
    const target = Number(match[1]);
    const suffix = match[2];
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setShown(progress < 1 ? `${Math.round(target * eased)}${suffix}` : value);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
    // Only on mount: a later change of value just shows the new value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <span>{shown}</span>;
}
