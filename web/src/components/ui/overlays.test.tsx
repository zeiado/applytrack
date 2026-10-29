import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import { Sheet, SheetContent, SheetTitle } from "./sheet";
import { ToastProvider, useToast } from "./toast";

function ShowToast({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => toast.add({ title: "Moved to Interviewing", actionProps: { children: "Undo", onClick: onUndo } })}
    >
      move
    </button>
  );
}

describe("ToastProvider", () => {
  it("shows a toast with its action, and closes it", async () => {
    const onUndo = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ToastProvider>
          <ShowToast onUndo={onUndo} />
        </ToastProvider>
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "move" }));
    expect(await screen.findByText("Moved to Interviewing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: en.Toast.close })).toBeTruthy();
  });
});

describe("Sheet", () => {
  it("renders its content as a labelled dialog with a close button", () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent closeLabel="Close">
          <SheetTitle>Nile Labs</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("dialog", { name: "Nile Labs" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalled();
  });
});
