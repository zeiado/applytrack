import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** The card every sign-in screen sits in. */
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>{title}</h1>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {/* Forms read the URL (?next=, #token=), which is only known in the browser. */}
      <CardContent>
        <Suspense>{children}</Suspense>
      </CardContent>
    </Card>
  );
}
