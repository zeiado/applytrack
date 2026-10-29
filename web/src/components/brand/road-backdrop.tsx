import { cn } from "@/lib/utils";

// A few winding roads, drawn like a transit map on a 1440×900 grid: straight runs, semicircle
// turns, round ends and a stop here and there. Some run off the edges so the pattern reads as
// part of a bigger map. Decorative and without text, so it needs no right-to-left version.
const ROADS = [
  "M-40 150 H300 A70 70 0 0 1 300 290 H120 A70 70 0 0 0 120 430 H470",
  "M890 -40 V110 A80 80 0 0 0 970 190 H1250 A75 75 0 0 1 1250 340 H1090",
  "M1480 610 H1150 A85 85 0 0 0 1150 780 H1490",
  "M260 940 V780 A65 65 0 0 1 325 715 H690 A65 65 0 0 0 755 650 V560",
  "M600 -40 V40 A60 60 0 0 0 660 100 H760",
];

const STOPS = [
  [190, 150],
  [230, 290],
  [360, 430],
  [1080, 190],
  [1180, 340],
  [1290, 610],
  [1320, 780],
  [480, 715],
  [700, 100],
];

/** The road-map background behind the public pages. It sits behind everything, never
 * takes clicks and is hidden from screen readers. */
export function RoadBackdrop({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none fixed inset-0 -z-10 size-full", className)}
    >
      <g className="stroke-primary/[0.05] dark:stroke-primary/[0.07]" fill="none" strokeWidth={14} strokeLinecap="round">
        {ROADS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className="fill-primary/[0.09] dark:fill-primary/[0.11]">
        {STOPS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={6} />
        ))}
      </g>
    </svg>
  );
}
