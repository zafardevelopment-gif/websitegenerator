/** Client-safe URL helpers (NEXT_PUBLIC vars only). */

const SITES_URL = process.env.NEXT_PUBLIC_SITES_URL ?? "http://localhost:3001";
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "aivexallp.com";

/** Public URL a demo is served at. */
export function demoUrl(slug: string): string {
  if (SITES_URL.includes("localhost")) {
    const port = new URL(SITES_URL).port || "3001";
    return `http://${slug}.localhost:${port}`;
  }
  return `https://${slug}.${BASE_DOMAIN}`;
}

export function sitesBaseUrl(): string {
  return SITES_URL;
}
