import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import { addChip, ChipsInput } from "./chips-input";

function renderChips(initial: string[] = []) {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ChipsInput name="skills" label="Skills" hint="hint" placeholder="e.g. Python" initial={initial} max={30} />
    </NextIntlClientProvider>,
  );
  const hidden = () => (container.querySelector('input[type="hidden"]') as HTMLInputElement).value;
  return { hidden };
}

describe("addChip", () => {
  it("skips empty items, duplicates in any case, and anything past the limit", () => {
    expect(addChip(["Python"], " python ", 30)).toEqual(["Python"]);
    expect(addChip(["Python"], "  ", 30)).toEqual(["Python"]);
    expect(addChip(["A", "B"], "C", 2)).toEqual(["A", "B"]);
    expect(addChip([], " SQL ", 30)).toEqual(["SQL"]);
  });
});

describe("ChipsInput", () => {
  it("turns commas, Arabic ones too, into chips and keeps what's still typed", () => {
    const { hidden } = renderChips();
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "Python, SQL، python, Ex" } });

    const chips = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Python", "SQL"]);
    expect(screen.getByLabelText("Skills")).toHaveProperty("value", " Ex");
    expect(hidden()).toBe("Python, SQL, Ex");
  });

  it("adds on Enter and removes with × or Backspace", () => {
    const { hidden } = renderChips(["Excel"]);
    const input = screen.getByLabelText("Skills");
    fireEvent.change(input, { target: { value: "Figma" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(hidden()).toBe("Excel, Figma");

    fireEvent.click(screen.getByRole("button", { name: "Remove Excel" }));
    expect(hidden()).toBe("Figma");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(hidden()).toBe("");
  });
});
