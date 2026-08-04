"use client";

/**
 * Catches errors thrown from the root layout itself. Must render its own
 * <html>/<body> and avoid any import that could itself be part of a broken
 * provider tree — plain inline styles only.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0f0f10", color: "#fff" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              This website isn&apos;t available right now
            </h1>
            <p style={{ opacity: 0.7, marginBottom: 16 }}>Please try again in a moment.</p>
            <button
              onClick={reset}
              style={{
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
          </div>
        </div>
      </body>
    </html>
  );
}
