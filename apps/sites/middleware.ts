import { NextResponse, type NextRequest } from "next/server";

/**
 * Multi-tenant host routing (ARCHITECTURE.md §2.1).
 *
 * smiledental.aivexallp.com  → rewrite to /t/smiledental/...
 * smiledental.localhost:3001 → rewrite to /t/smiledental/... (local dev)
 * aivexallp.com / localhost  → base landing page
 * anything else              → treated as a custom client domain (Phase 14)
 *
 * The URL in the browser never changes — the rewrite is internal. Direct
 * requests to /t/... on the base domain are blocked; on tenant hosts every
 * path (including /t/...) is rewritten first, so no collision is possible.
 */

const BASE_DOMAIN = (process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "aivexallp.com").toLowerCase();

// The bare Vercel deployment URL(s) for this project — admin's live preview
// iframe hits this host directly (no tenant subdomain exists for it), so it
// must be treated as a base host exactly like the real BASE_DOMAIN. Without
// this, /preview/site/[id] gets misrouted through the tenant rewrite below
// and renders the "no active website" holding page instead of the draft.
function hostnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const VERCEL_DEPLOYMENT_HOSTS = new Set(
  [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    // Whatever host this app is actually reachable at (custom domain or
    // vercel.app) — e.g. admin's preview iframe / sites.aivexallp.com. Any
    // subdomain of BASE_DOMAIN would otherwise be swallowed by the tenant
    // rewrite below and mistaken for a tenant slug.
    hostnameOf(process.env.NEXT_PUBLIC_SITES_URL ?? undefined),
  ]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.toLowerCase())
);

function resolveTenant(hostname: string): string | null {
  if (
    hostname === BASE_DOMAIN ||
    hostname === `www.${BASE_DOMAIN}` ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    VERCEL_DEPLOYMENT_HOSTS.has(hostname) ||
    hostname.endsWith(".vercel.app")
  ) {
    return null;
  }
  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    return hostname.slice(0, -(BASE_DOMAIN.length + 1));
  }
  if (hostname.endsWith(".localhost")) {
    return hostname.slice(0, -".localhost".length);
  }
  // Unknown host → future custom client domain; the site lookup (Phase 5)
  // resolves it against the aiwebsite_domains table.
  return hostname;
}

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const hostname = host.split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

  const tenant = resolveTenant(hostname);
  if (!tenant) {
    // Never allow direct access to the internal tenant routes on base hosts.
    if (
      pathname === "/t" ||
      pathname.startsWith("/t/") ||
      pathname === "/t-meta" ||
      pathname.startsWith("/t-meta/")
    ) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // Shared endpoints that must not be tenant-rewritten (OG images, API,
  // the tracking script served as a static public asset).
  if (
    pathname.startsWith("/og/") ||
    pathname.startsWith("/api/") ||
    pathname === "/t.js"
  ) {
    return NextResponse.next();
  }
  // Per-tenant SEO files.
  if (pathname === "/robots.txt") {
    const url = request.nextUrl.clone();
    url.pathname = `/t-meta/${tenant}/robots`;
    return NextResponse.rewrite(url);
  }
  if (pathname === "/sitemap.xml") {
    const url = request.nextUrl.clone();
    url.pathname = `/t-meta/${tenant}/sitemap`;
    return NextResponse.rewrite(url);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/t/${tenant}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
