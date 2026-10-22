import { useLocale } from "next-intl";

import { APP_NAME } from "@/config/brand";
import { cn } from "@/lib/utils";

// Sizes from each SVG's viewBox, so the image keeps its shape while it loads.
const LOGOS = {
  "horizontal-latin": { width: 225.257, height: 48 },
  "horizontal-arabic": { width: 149.557, height: 48 },
  symbol: { width: 55.25, height: 49.25 },
} as const;

/** The Sekka logo: drawn lettering, never typed text (see brand/BRAND.md). The horizontal
 * lockup follows the page language. Dark mode swaps in the white "reversed" artwork, since
 * the colour version's dark lettering would disappear. Set the size with a height class. */
export function Logo({ variant = "horizontal", className }: { variant?: "horizontal" | "symbol"; className?: string }) {
  const locale = useLocale();
  const name = variant === "symbol" ? "symbol" : locale === "ar" ? "horizontal-arabic" : "horizontal-latin";
  const { width, height } = LOGOS[name];
  const image = (version: "color" | "reversed", visibility: string) => (
    // A plain <img>: SVGs gain nothing from the image optimiser.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/sekka-${name}-${version}.svg`}
      alt={APP_NAME}
      width={width}
      height={height}
      className={cn("h-7 w-auto", visibility, className)}
    />
  );
  return (
    <>
      {image("color", "dark:hidden")}
      {image("reversed", "hidden dark:block")}
    </>
  );
}
