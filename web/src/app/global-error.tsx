"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Shown when even the root layout fails, so it can't use translations or the app's
 * styles: plain markup, in both languages. Reports the error to Sentry (#70). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F5FBF7",
          color: "#171D1B",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <main style={{ padding: 24 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>حصلت مشكلة</h1>
          <p lang="en" dir="ltr" style={{ margin: "0 0 24px", color: "#3F4946" }}>
            Something went wrong.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 12,
              padding: "12px 24px",
              background: "#00695A",
              color: "#FFFFFF",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            جرّب تاني · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
