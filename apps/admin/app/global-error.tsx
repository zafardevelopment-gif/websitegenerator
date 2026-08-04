"use client";

/**
 * Catches errors thrown from the root layout itself (theme provider, font
 * loading, etc.) — the one class of error apps/admin/app/(app)/error.tsx
 * cannot catch, since that boundary lives inside the layout it would need
 * to replace. Must render its own <html>/<body>; no design-system imports
 * (if the crash is in the provider tree, those may be unavailable too).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ color: "#71717a", marginBottom: 16, wordBreak: "break-word" }}>
              {error.message || "The app failed to load."}
            </p>
            <button
              onClick={reset}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid #d4d4d8",
                background: "#fff",
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
