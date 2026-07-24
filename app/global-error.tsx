"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Root error boundary — replaces the entire root layout when rendering
 * crashes, so it must render its own <html>/<body>. Reports to Sentry and
 * offers a retry. Copy is intentionally locale-neutral: next-intl context is
 * unavailable at this level.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="uz">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: "2.5rem", margin: 0 }}>⚠️</p>
          <h1 style={{ fontSize: "1.25rem", margin: "1rem 0 0.5rem" }}>
            Xatolik yuz berdi / Something went wrong
          </h1>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Qayta urinish / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
