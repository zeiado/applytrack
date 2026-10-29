import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import { SiteNavBar } from "./site-nav";

// The real Link needs the Next.js router; a plain anchor shows where it points.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: { href: string } & React.ComponentProps<"a">) => <a href={href} {...props} />,
  usePathname: () => "/features",
}));

function renderAt(current: string | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SiteNavBar current={current} />
    </NextIntlClientProvider>,
  );
}

describe("SiteNavBar", () => {
  it("links to the public pages and marks the current one", () => {
    renderAt("/roadmap");

    const nav = screen.getByRole("navigation", { name: en.Site.nav.main });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/features", "/roadmap", "/about"]);
    expect(within(nav).getByRole("link", { name: en.Site.nav.roadmap }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: en.Site.nav.features }).getAttribute("aria-current")).toBeNull();
  });

  it("offers Log in and Start free", () => {
    renderAt(null);

    expect(screen.getByRole("link", { name: en.Home.logIn }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: en.Home.getStarted }).getAttribute("href")).toBe("/register");
  });

  it("opens the phone menu with the same pages", async () => {
    renderAt("/about");

    fireEvent.click(screen.getByRole("button", { name: en.Site.nav.menu }));

    const sheet = await screen.findByRole("dialog");
    const about = within(sheet).getByRole("link", { name: en.Site.nav.about });
    expect(about.getAttribute("aria-current")).toBe("page");
    expect(within(sheet).getByRole("button", { name: en.Site.nav.close })).toBeTruthy();
  });
});
