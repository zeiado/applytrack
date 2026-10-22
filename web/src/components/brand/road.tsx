import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";

/** The road motif as a thin, decorative track: a teal dot where you start (the reading
 * start) and the amber "yes" dot where it ends. Arabic gets its own coordinates rather
 * than a CSS flip (see brand/REDESIGN.md). */
export function RoadLine({ className }: { className?: string }) {
  const rtl = useLocale() === "ar";
  const [start, end] = rtl ? [330, 12] : [12, 330];
  return (
    <svg aria-hidden viewBox="0 0 342 24" className={cn("h-6 w-full max-w-xs", className)}>
      <path d="M26 12 H316" className="stroke-primary/25" strokeWidth={3} strokeLinecap="round" />
      <path d="M26 12 H316" className="stroke-background" strokeWidth={1} strokeDasharray="6 6" />
      <circle cx={start} cy={12} r={6} className="fill-primary" />
      <circle cx={end} cy={12} r={7} className="fill-yes" />
    </svg>
  );
}

// The winding road from the landing mockups (04-landing-*.html), on a 560×470 grid. Arabic
// has its own path and positions so the road runs right to left and the labels stay readable.
const ROADS = {
  ltr: {
    path: "M40 410 H400 A65 65 0 0 0 400 280 H160 A65 65 0 0 1 160 150 H420",
    stops: [
      [90, 410],
      [290, 410],
      [330, 280],
      [200, 280],
      [300, 150],
    ],
    yes: [480, 150],
  },
  rtl: {
    path: "M520 410 H160 A65 65 0 0 1 160 280 H400 A65 65 0 0 0 400 150 H140",
    stops: [
      [470, 410],
      [270, 410],
      [230, 280],
      [360, 280],
      [260, 150],
    ],
    yes: [80, 150],
  },
} as const;

/** The job search as a road: a stop for each stage, ending at the amber "yes".
 * `stages` are the five stop labels in order (wishlist → offer). */
export function RoadIllustration({
  stages,
  yes,
  label,
  className,
}: {
  stages: readonly string[];
  yes: string;
  label: string;
  className?: string;
}) {
  const road = ROADS[useLocale() === "ar" ? "rtl" : "ltr"];
  const [yesX, yesY] = road.yes;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 560 470" className={cn("h-auto w-full", className)}>
      <path
        d={road.path}
        fill="none"
        className="stroke-primary"
        strokeWidth={30}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={road.path}
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth={2}
        strokeDasharray="10 10"
        opacity={0.8}
      />
      <circle cx={yesX} cy={yesY} r={22} className="fill-yes" />
      {road.stops.map(([x, y], index) => (
        <g key={index}>
          <circle cx={x} cy={y} r={8} className="fill-primary-foreground stroke-primary" strokeWidth={3} />
          {/* Labels sit below each stop, except on the top row, where they go above. */}
          <text
            x={x}
            y={y === 150 ? y - 30 : y + 42}
            textAnchor="middle"
            className="fill-muted-foreground text-[15px] rtl:text-[16px]"
          >
            {stages[index]}
          </text>
        </g>
      ))}
      <text
        x={yesX}
        y={yesY - 39}
        textAnchor="middle"
        className="fill-foreground text-[17px] font-semibold rtl:text-[19px]"
      >
        {yes}
      </text>
    </svg>
  );
}
