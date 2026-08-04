import { NextResponse } from "next/server";

import { getSiteBundle } from "@/lib/site-data";

/** Per-tenant robots.txt (middleware rewrites <slug>.<domain>/robots.txt here). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params;
  const slug = decodeURIComponent(tenant).toLowerCase();

  let allow = false;
  try {
    const bundle = await getSiteBundle(slug);
    allow = !!bundle && bundle.site.status === "live" && !bundle.site.noindex;
  } catch {
    allow = false;
  }

  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "aivexallp.com";
  const body = allow
    ? `User-agent: *\nAllow: /\n\nSitemap: https://${slug}.${base}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";

  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
  });
}
