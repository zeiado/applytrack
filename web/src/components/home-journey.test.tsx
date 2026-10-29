import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { HomeJourney } from "./home-journey";

// The real Link needs the Next.js router; a plain anchor shows where it points.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: { href: string } & React.ComponentProps<"a">) => <a href={href} {...props} />,
}));

function renderIn(locale: "ar" | "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en}>
      <HomeJourney />
    </NextIntlClientProvider>,
  );
}

describe("HomeJourney", () => {
  it("walks through the four steps in order, ending at a yes", () => {
    renderIn("en");

    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    const { save, track, followUp, yes } = en.Home.journey.steps;
    expect(steps.map((step) => within(step).getByRole("heading", { level: 3 }).textContent)).toEqual([
      save.title,
      track.title,
      followUp.title,
      yes.title,
    ]);
  });

  it("keeps the screen previews away from screen readers", () => {
    renderIn("en");

    // The sample job only appears inside the previews, and every preview is hidden.
    const samples = screen.getAllByText(en.Home.journey.demo.role);
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) expect(sample.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("renders in Arabic", () => {
    renderIn("ar");

    expect(screen.getByRole("heading", { level: 2, name: ar.Home.journey.title })).toBeTruthy();
  });
});
