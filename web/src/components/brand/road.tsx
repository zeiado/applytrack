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

// How far along the road each stop sits (0 to 1): the straight runs are 360, 240 and 260
// long and each turn is π × 65, about 1268 in all. The same for both directions.
const STOP_AT = [0.04, 0.2, 0.5, 0.6, 0.9];

// The opening animation (globals.css, .road-intro): the road draws itself, a traveller rides
// it, each stop lights up as it passes and the "yes" arrives last. Seconds.
const TRAVEL_START = 0.3;
const TRAVEL_TIME = 2;
const at = (fraction: number) => `${(TRAVEL_START + TRAVEL_TIME * fraction).toFixed(2)}s`;

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
    <svg role="img" aria-label={label} viewBox="0 0 560 470" className={cn("road-intro h-auto w-full", className)}>
      <path
        d={road.path}
        pathLength={1}
        fill="none"
        className="road-intro-track stroke-primary"
        strokeWidth={30}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={road.path}
        fill="none"
        className="road-intro-lines stroke-primary-foreground"
        strokeWidth={2}
        strokeDasharray="10 10"
        opacity={0.8}
      />
      {/* The "yes": a ring that ripples out once, then the amber dot. */}
      <circle cx={yesX} cy={yesY} r={22} className="road-intro-ripple fill-none stroke-yes" strokeWidth={3} />
      <circle cx={yesX} cy={yesY} r={22} className="road-intro-yes fill-yes" />
      {road.stops.map(([x, y], index) => (
        <g key={index} className="road-intro-stop" style={{ "--road-at": at(STOP_AT[index] ?? 1) } as React.CSSProperties}>
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
      {/* The traveller: rides the road once, from the first stop to the yes. */}
      <circle
        r={14}
        className="road-intro-traveller fill-primary-foreground stroke-primary"
        strokeWidth={6}
        style={{ offsetPath: `path("${road.path}")` }}
      />
      <text
        x={yesX}
        y={yesY - 39}
        textAnchor="middle"
        className="road-intro-yes-label fill-foreground text-[17px] font-semibold rtl:text-[19px]"
      >
        {yes}
      </text>
    </svg>
  );
}
