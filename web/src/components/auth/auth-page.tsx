import { Suspense } from "react";

import { RoadLine } from "@/components/brand/road";

import { LargeFormParts } from "./form-parts";

/** What every sign-in screen sits in: straight on the page on phones, a card from `sm` up. */
export function AuthPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sm:bg-card grid w-full max-w-sm gap-6 sm:rounded-2xl sm:border sm:p-8">
      <header className="grid gap-3.5">
        <RoadLine className="max-w-none" />
        <h1 className="text-2xl leading-snug font-semibold">{title}</h1>
        {description && <p className="text-muted-foreground text-base">{description}</p>}
      </header>
      {/* Forms read the URL (?next=, #token=), which is only known in the browser. */}
      <LargeFormParts>
        <Suspense>{children}</Suspense>
      </LargeFormParts>
    </section>
  );
}
