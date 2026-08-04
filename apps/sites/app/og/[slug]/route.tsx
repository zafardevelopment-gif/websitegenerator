import { ImageResponse } from "next/og";

import {
  getColorVariant,
  getTemplate,
  parseSiteContent,
} from "@aiwebsite/templates";

import { getSiteBundle } from "@/lib/site-data";

export const runtime = "nodejs";

/** Auto-generated Open Graph card: brand colors + name + tagline + rating. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let name = slug;
  let tagline = "";
  let rating: number | null = null;
  let reviews: number | null = null;
  let primary = "#4f46e5";
  let secondary = "#312e81";

  try {
    const bundle = await getSiteBundle(decodeURIComponent(slug).toLowerCase());
    if (bundle) {
      const template = getTemplate(bundle.templateKey);
      const variant = getColorVariant(template, bundle.site.color_variant);
      primary = variant.primary;
      secondary = variant.secondary;
      name = bundle.site.name;
      const content = parseSiteContent(bundle.content);
      if (content) {
        tagline = content.hero.subtitle || content.footer.tagline || content.meta.description;
        rating = content.business.rating;
        reviews = content.business.reviewCount;
      }
    }
  } catch {
    // render the fallback card
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: `linear-gradient(120deg, ${primary}, ${secondary})`,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
          {name}
        </div>
        {tagline && (
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 30,
              opacity: 0.92,
              maxWidth: 900,
            }}
          >
            {tagline.slice(0, 120)}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", marginTop: 48, gap: 16 }}>
          {rating !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "10px 26px",
                fontSize: 28,
              }}
            >
              ★ {rating.toFixed(1)}
              {reviews !== null ? ` · ${reviews} Google reviews` : ""}
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
