import "server-only";

/**
 * Simple in-memory sliding-window rate limiter for the tracking ingest
 * endpoints. Per-process (fine for a single Vercel instance / dev); the
 * limits are generous — this guards against abuse, not legitimate traffic.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

const buckets = new Map<string, number[]>();

// Bound memory: drop old keys occasionally.
let lastSweep = Date.now();

export function rateLimited(key: string): boolean {
  const now = Date.now();
  if (now - lastSweep > 300_000) {
    for (const [k, timestamps] of buckets) {
      if (timestamps.every((t) => now - t > WINDOW_MS)) buckets.delete(k);
    }
    lastSweep = now;
  }

  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_PER_WINDOW) {
    buckets.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return false;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
