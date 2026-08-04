import { NextResponse } from "next/server";

import { getSiteBundle } from "@/lib/site-data";

/** Per-tenant sitemap.xml — single-page sites, one URL entry. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params;
  const slug = decodeURIComponent(tenant).toLowerCase();
  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "aivexallp.com";

  let lastmod = new Date().toISOString();
  let ok = false;
  try {
    const bundle = await getSiteBundle(slug);
    if (bundle && bundle.site.status === "live") {
      ok = true;
      lastmod = bundle.site.updated_at;
    }
  } catch {
    ok = false;
  }

  if (!ok) return new NextResponse("Not found", { status: 404 });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${slug}.${base}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
  });
}
