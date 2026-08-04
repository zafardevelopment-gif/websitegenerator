"use client";

import { AGENCY_NAME } from "@aiwebsite/config";

/**
 * Catches render errors anywhere under the tenant renderer, OG image route,
 * or preview routes. Visitors must never see Next's default error page or
 * a raw stack trace — degrade to the same branded holding-page look.
 */
export default function SitesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="holding-body">
      <main className="holding-card">
        <span className="brand-badge">A</span>
        <h1>This website isn&apos;t available right now</h1>
        <p>Something went wrong loading this page. Please try again in a moment.</p>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <p>Powered by {AGENCY_NAME}</p>
      </main>
    </div>
  );
}
