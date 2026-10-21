import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { HomeHero } from "./home-hero";

// The real Link needs the Next.js router; a plain anchor shows where it points.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: { href: string } & React.ComponentProps<"a">) => (
    <a href={href} {...props} />
  ),
}));

function renderIn(locale: "ar" | "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en}>
      <HomeHero />
    </NextIntlClientProvider>,
  );
}

describe("HomeHero", () => {
  it("links to sign-up and login", () => {
    renderIn("en");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(en.Home.tagline);
    expect(screen.getByRole("link", { name: en.Home.getStarted }).getAttribute("href")).toBe(
      "/register",
    );
    expect(screen.getByRole("link", { name: en.Home.logIn }).getAttribute("href")).toBe("/login");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
  });

  it("renders in Arabic", () => {
    renderIn("ar");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(ar.Home.tagline);
  });
});
