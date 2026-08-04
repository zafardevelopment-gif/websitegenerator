import "server-only";

/**
 * Simple in-memory sliding-window rate limiter for public, unauthenticated
 * admin endpoints (e.g. the email-open tracking pixel). Per-process (fine
 * for a single Vercel instance / dev) — mirrors apps/sites/lib/rate-limit.ts.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

const buckets = new Map<string, number[]>();
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
