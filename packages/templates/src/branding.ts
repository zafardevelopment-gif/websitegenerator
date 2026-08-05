/**
 * Branding resolution: template color variants + per-site overrides →
 * CSS custom properties consumed by every template via Tailwind tokens
 * (--site-primary → bg-brand etc., mapped in apps/sites globals.css).
 */

export interface ColorVariant {
  key: string;
  label: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  accent: string;
  /** Page background tint & surface color. */
  background: string;
  surface: string;
  ink: string;
  muted: string;
  /** Hairline/border color tuned to the palette. */
  hairline?: string;
  /** Corner language: how rounded cards & buttons are. */
  radius?: "sharp" | "soft" | "pill";
  /** Dark-styled template (gym/restaurant variants). */
  dark?: boolean;
}

const RADIUS_SCALE: Record<NonNullable<ColorVariant["radius"]>, string> = {
  sharp: "0.375rem",
  soft: "1.5rem",
  pill: "2rem",
};

/** Visual tone preset — mirrors `TonePreset` in ./types and @aiwebsite/ai. */
export type ToneKey = "premium" | "friendly" | "medical-professional" | "luxury";

/**
 * Tone → CSS custom properties, layered on top of the color variant's
 * tokens in `brandingStyle()`. These drive the primary visible signal for
 * tone: heading weight/tracking, corner radius, section density, body size.
 */
export const TONE_STYLES: Record<ToneKey, Record<string, string>> = {
  premium: {
    "--site-heading-weight": "800",
    "--site-heading-tracking": "-0.045em",
    "--site-radius": "0.75rem",
    "--site-section-py": "5.5rem",
    "--site-body-scale": "1",
  },
  friendly: {
    "--site-heading-weight": "700",
    "--site-heading-tracking": "-0.015em",
    "--site-radius": "1.75rem",
    "--site-section-py": "6rem",
    "--site-body-scale": "1.05",
  },
  "medical-professional": {
    "--site-heading-weight": "600",
    "--site-heading-tracking": "-0.01em",
    "--site-radius": "0.5rem",
    "--site-section-py": "4.5rem",
    "--site-body-scale": "0.97",
  },
  luxury: {
    "--site-heading-weight": "500",
    "--site-heading-tracking": "0.015em",
    "--site-radius": "0.25rem",
    "--site-section-py": "7rem",
    "--site-body-scale": "1.02",
  },
};

export interface LayoutVariant {
  key: string;
  label: string;
}

export interface ResolvedBranding {
  colors: ColorVariant;
  fontHeading: string;
  fontBody: string;
}

/** Curated Google Fonts (name → css2 family param). */
export const FONT_FAMILIES: Record<string, string> = {
  // Body / UI
  Inter: "Inter:wght@400;500;600;700",
  "DM Sans": "DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700",
  Manrope: "Manrope:wght@400;500;600;700",
  "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700",
  Poppins: "Poppins:wght@400;500;600;700",
  Montserrat: "Montserrat:wght@400;500;600;700",
  Lora: "Lora:wght@400;500;600",
  // Display / heading
  Sora: "Sora:wght@400;500;600;700;800",
  Outfit: "Outfit:wght@400;500;600;700;800",
  "Space Grotesk": "Space+Grotesk:wght@400;500;600;700",
  Syne: "Syne:wght@500;600;700;800",
  "Bricolage Grotesque": "Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800",
  Fraunces: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700",
  "Instrument Serif": "Instrument+Serif:ital@0;1",
  "Playfair Display": "Playfair+Display:wght@500;600;700;800",
  "Cormorant Garamond": "Cormorant+Garamond:wght@400;500;600;700",
  Merriweather: "Merriweather:wght@400;700",
  Oswald: "Oswald:wght@400;500;600;700",
};

export function googleFontsHref(fonts: string[]): string {
  const families = Array.from(new Set(fonts))
    .map((f) => FONT_FAMILIES[f])
    .filter(Boolean)
    .map((family) => `family=${family}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Per-site branding overrides stored in aiwebsite_sites.branding (jsonb). */
export interface BrandingOverrides {
  primary?: string;
  secondary?: string;
  accent?: string;
  fontHeading?: string;
  fontBody?: string;
}

export function parseBrandingOverrides(raw: unknown): BrandingOverrides {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const pick = (key: string) => (typeof r[key] === "string" ? (r[key] as string) : undefined);
  return {
    primary: pick("primary"),
    secondary: pick("secondary"),
    accent: pick("accent"),
    fontHeading: pick("fontHeading") ?? pick("font_heading"),
    fontBody: pick("fontBody") ?? pick("font_body"),
  };
}

export function resolveBranding(
  variant: ColorVariant,
  overrides: BrandingOverrides,
  defaults: { heading: string; body: string }
): ResolvedBranding {
  return {
    colors: {
      ...variant,
      primary: overrides.primary ?? variant.primary,
      secondary: overrides.secondary ?? variant.secondary,
      accent: overrides.accent ?? variant.accent,
    },
    fontHeading:
      overrides.fontHeading && overrides.fontHeading in FONT_FAMILIES
        ? overrides.fontHeading
        : defaults.heading,
    fontBody:
      overrides.fontBody && overrides.fontBody in FONT_FAMILIES
        ? overrides.fontBody
        : defaults.body,
  };
}

/**
 * CSS variables injected on the site root element. `tone` (default
 * "premium") layers heading weight/tracking, corner radius and section
 * density on top of the color variant's tokens.
 */
export function brandingStyle(
  branding: ResolvedBranding,
  tone: ToneKey = "premium"
): Record<string, string> {
  const c = branding.colors;
  return {
    "--site-primary": c.primary,
    "--site-primary-foreground": c.primaryForeground,
    "--site-secondary": c.secondary,
    "--site-accent": c.accent,
    "--site-background": c.background,
    "--site-surface": c.surface,
    "--site-ink": c.ink,
    "--site-muted": c.muted,
    "--site-hairline": c.hairline ?? (c.dark ? "rgb(255 255 255 / 0.10)" : "rgb(0 0 0 / 0.08)"),
    "--site-radius": RADIUS_SCALE[c.radius ?? "soft"],
    "--site-font-heading": `'${branding.fontHeading}', ui-sans-serif, sans-serif`,
    "--site-font-body": `'${branding.fontBody}', ui-sans-serif, sans-serif`,
    // Tone tokens override radius (and add heading/spacing tokens) so the
    // tone preset reads as the primary visible signal.
    ...TONE_STYLES[tone],
  };
}
