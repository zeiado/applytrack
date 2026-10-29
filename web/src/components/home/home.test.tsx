import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { ExtensionDemo } from "./extension-demo";
import { type FlipCopy, LanguageFlip } from "./language-flip";
import { HomeFaq, HomeFinale } from "./sections";
import { TryBoard } from "./try-board";

// The real Link needs the Next.js router; a plain anchor shows where it points.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: { href: string } & React.ComponentProps<"a">) => <a href={href} {...props} />,
}));

function inEnglish(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("TryBoard", () => {
  it("moves a card one stage at a time, and an offer shows the banner", () => {
    inEnglish(<TryBoard />);
    const company = en.Home.try.thirdCompany;

    fireEvent.click(screen.getByRole("button", { name: `Move ${company} to ${en.Status.offer}` }));

    const offer = screen.getByRole("region", { name: en.Status.offer });
    expect(within(offer).getByText(company)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(`${company} sent you an offer`);

    fireEvent.click(screen.getByRole("button", { name: en.Home.try.reset }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(within(screen.getByRole("region", { name: en.Status.interviewing })).getByText(company)).toBeTruthy();
  });
});

describe("ExtensionDemo", () => {
  it("opens the popup filled in from the page, then saves", () => {
    inEnglish(<ExtensionDemo />);

    fireEvent.click(screen.getByRole("button", { name: en.Home.extension.openPopup }));
    expect(screen.getAllByText(en.Home.journey.demo.company).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: en.Home.extension.save }));

    expect(screen.getByRole("status").textContent).toContain(en.Home.extension.saved);
  });
});

describe("LanguageFlip", () => {
  const copy = (messages: typeof en, name: string): FlipCopy => ({
    name,
    tagline: messages.Home.tagline,
    status: messages.Status.applied,
    company: messages.Home.journey.demo.company,
    role: messages.Home.journey.demo.role,
    followUp: messages.Applications.card.followUpDue,
  });

  it("switches the preview's language and direction", () => {
    render(<LanguageFlip copy={{ ar: copy(ar, "العربية"), en: copy(en, "English") }} start="en" label="Language" />);
    expect(screen.getByText(en.Home.tagline)).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "العربية" }));

    const tagline = screen.getByText(ar.Home.tagline);
    expect(tagline.closest("[dir]")?.getAttribute("dir")).toBe("rtl");
    expect(screen.getByRole("radio", { name: "العربية" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("HomeFaq and HomeFinale", () => {
  it("answers the common questions and ends with sign-up", () => {
    inEnglish(
      <>
        <HomeFaq />
        <HomeFinale />
      </>,
    );

    expect(screen.getByText(en.Home.faq.items.free.q)).toBeTruthy();
    expect(screen.getByText(en.Home.faq.items.data.a)).toBeTruthy();
    expect(screen.getByRole("link", { name: en.Home.getStarted }).getAttribute("href")).toBe("/register");
  });
});
