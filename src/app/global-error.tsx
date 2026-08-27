"use client";

import { useEffect } from "react";

/**
 * Catches a throw from the root layout itself -- e.g. Supabase unreachable,
 * since layout.tsx awaits getSettings()/getCategories() on every request.
 * error.tsx can't catch that: a route-segment boundary sits inside the
 * layout it's nested under, so it never sees a failure the layout produces.
 * Only this file, one level further out, can.
 *
 * It replaces the <html>/<body> the crashed layout would have rendered, so
 * it can't lean on anything that layout provides -- no CartProvider, no
 * fonts, no Tailwind utility classes. Inline styles only, and no attempt to
 * read a contact address from settings: that's exactly the fetch that may
 * have just failed.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#3a2f2a",
          background: "#fbf8f3",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Sorry, we&rsquo;re having trouble
        </h1>
        <p style={{ color: "#6b5f57", maxWidth: "26rem", margin: 0 }}>
          The site is temporarily unavailable. This isn&rsquo;t about
          anything you did &mdash; please try again in a few minutes.
        </p>
        {/* A plain <a>, not next/link: this file is the fallback for when the
            app's own tree has already thrown, so it shouldn't lean on the
            client router that tree provides. A full document reload is the
            more reliable choice here, not a lesser one. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.25rem",
            borderRadius: "0.5rem",
            background: "#b35b37",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Try again
        </a>
      </body>
    </html>
  );
}
