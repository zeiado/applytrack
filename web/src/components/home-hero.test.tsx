import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { HomeHero } from "./home-hero";

// The real Link needs the Next.js router; a plain anchor shows where it points.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: { href: string } & React.ComponentProps<"a">) => <a href={href} {...props} />,
}));

function renderIn(locale: "ar" | "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en}>
      <HomeHero />
    </NextIntlClientProvider>,
  );
}

describe("HomeHero", () => {
  it("has one way in: sign up", () => {
    renderIn("en");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(en.Home.tagline);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: en.Home.getStarted }).getAttribute("href")).toBe("/register");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
  });

  it("draws the road through the stages to a yes", () => {
    renderIn("en");

    const road = screen.getByRole("img", { name: en.Home.road.label });
    for (const stage of [en.Status.wishlist, en.Status.applied, en.Status.offer, en.Home.road.yes]) {
      expect(road.textContent).toContain(stage);
    }
  });

  it("renders in Arabic", () => {
    renderIn("ar");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(ar.Home.tagline);
    expect(screen.getByRole("img", { name: ar.Home.road.label }).textContent).toContain(ar.Home.road.yes);
  });
});
