import type * as React from "react";

import type { ColorVariant, LayoutVariant } from "./branding";
import { SAMPLE_CONTENT } from "./sample-content";
import type { SiteContent } from "./schema";
import { DentalTemplate } from "./templates/dental";
import { GeneralTemplate } from "./templates/general";
import { GymTemplate } from "./templates/gym";
import { RestaurantTemplate } from "./templates/restaurant";
import { SalonTemplate } from "./templates/salon";
import type { TemplateProps } from "./types";

/**
 * Template registry — adding a template is: create src/templates/<key>.tsx,
 * add one entry here, insert its row in aiwebsite_templates (same key).
 * See docs/ADDING_TEMPLATES.md (Phase 15).
 */

export interface TemplateDefinition {
  key: string;
  name: string;
  category: string;
  description: string;
  colorVariants: ColorVariant[];
  layoutVariants: LayoutVariant[];
  defaultFonts: { heading: string; body: string };
  component: React.ComponentType<TemplateProps>;
  sampleContent: SiteContent;
}

type Tuning = Pick<ColorVariant, "radius" | "background" | "surface" | "ink" | "muted" | "primaryForeground">;

/**
 * Light palettes sit on a warm near-white paper tone with a near-black ink —
 * higher contrast and less "default Tailwind" than pure #fff/#000.
 */
const light = (
  key: string,
  label: string,
  primary: string,
  secondary: string,
  accent: string,
  tuning: Partial<Tuning> = {}
): ColorVariant => ({
  key,
  label,
  primary,
  primaryForeground: "#ffffff",
  secondary,
  accent,
  background: "#f7f6f3",
  surface: "#ffffff",
  ink: "#14120f",
  muted: "#6b6560",
  hairline: "rgb(20 18 15 / 0.09)",
  radius: "soft",
  ...tuning,
});

/**
 * Dark palettes use a blue-black page with a lifted charcoal surface so the
 * glass header, hairlines and gradient edges stay legible.
 */
const dark = (
  key: string,
  label: string,
  primary: string,
  secondary: string,
  accent: string,
  tuning: Partial<Tuning> = {}
): ColorVariant => ({
  key,
  label,
  primary,
  primaryForeground: "#ffffff",
  secondary,
  accent,
  background: "#08080b",
  surface: "#111116",
  ink: "#f4f4f5",
  muted: "#9d9da8",
  hairline: "rgb(255 255 255 / 0.10)",
  radius: "soft",
  dark: true,
  ...tuning,
});

const sample = (key: string): SiteContent => {
  const content = SAMPLE_CONTENT[key];
  if (!content) throw new Error(`No sample content for template "${key}"`);
  return content;
};

export const TEMPLATES: Record<string, TemplateDefinition> = {
  dental: {
    key: "dental",
    name: "Bright Smile",
    category: "Dental Clinic",
    description: "Clinical calm with a cinematic hero, trust marquee and stats band.",
    colorVariants: [
      light("mint", "Clinical Mint", "#0f766e", "#052e2b", "#f0b429"),
      light("sky", "Deep Sky", "#0369a1", "#082f49", "#fb7185"),
      light("royal", "Royal Indigo", "#4338ca", "#1e1b4b", "#22d3ee"),
      light("coral", "Warm Coral", "#be123c", "#4c0519", "#0d9488"),
    ],
    layoutVariants: [
      { key: "classic", label: "Cinematic hero" },
      { key: "split-hero", label: "Split hero" },
    ],
    defaultFonts: { heading: "Sora", body: "Inter" },
    component: DentalTemplate,
    sampleContent: sample("dental"),
  },

  restaurant: {
    key: "restaurant",
    name: "Tandoor Table",
    category: "Restaurant",
    description: "Dark, appetite-driven theme with a typographic menu and photo mosaic.",
    colorVariants: [
      dark("ember", "Ember", "#f97316", "#7c2d12", "#fbbf24"),
      dark("saffron", "Saffron", "#eab308", "#713f12", "#f97316"),
      dark("olive", "Olive", "#84cc16", "#365314", "#fbbf24"),
      dark("noir", "Noir Rouge", "#f43f5e", "#4c0519", "#fda4af", {
        background: "#0a0708",
        surface: "#15100f",
      }),
    ],
    layoutVariants: [
      { key: "classic", label: "Story first" },
      { key: "gallery-first", label: "Menu first" },
    ],
    defaultFonts: { heading: "Fraunces", body: "DM Sans" },
    component: RestaurantTemplate,
    sampleContent: sample("restaurant"),
  },

  salon: {
    key: "salon",
    name: "Velvet Chair",
    category: "Salon",
    description: "Editorial beauty aesthetic — serif display type, menu-style services.",
    colorVariants: [
      light("blush", "Blush", "#be185d", "#500724", "#c084fc", {
        background: "#faf6f5",
        radius: "pill",
      }),
      light("noir", "Noir & Gold", "#1c1917", "#44403c", "#b08d3f", {
        background: "#f6f4f0",
        radius: "sharp",
      }),
      light("lavender", "Lavender", "#7c3aed", "#3b0764", "#f472b6", {
        background: "#f8f6fb",
        radius: "pill",
      }),
      light("sand", "Sand", "#a16207", "#451a03", "#0f766e", { background: "#faf7f0" }),
    ],
    layoutVariants: [
      { key: "classic", label: "Cinematic hero" },
      { key: "split-hero", label: "Split hero" },
    ],
    defaultFonts: { heading: "Playfair Display", body: "Manrope" },
    component: SalonTemplate,
    sampleContent: sample("salon"),
  },

  gym: {
    key: "gym",
    name: "Iron Pulse",
    category: "Gym",
    description: "High-energy dark theme where the numbers do the selling.",
    colorVariants: [
      dark("volt", "Volt", "#a3e635", "#365314", "#facc15", { primaryForeground: "#0a0a0a", radius: "sharp" }),
      dark("crimson", "Crimson", "#ef4444", "#450a0a", "#fb923c", { radius: "sharp" }),
      dark("steel", "Steel", "#38bdf8", "#0c4a6e", "#e4e4e7", { primaryForeground: "#08080b", radius: "sharp" }),
      dark("magma", "Magma", "#f97316", "#431407", "#fbbf24", { radius: "sharp" }),
    ],
    layoutVariants: [
      { key: "classic", label: "Classic" },
      { key: "stats-first", label: "Stats first" },
    ],
    defaultFonts: { heading: "Bricolage Grotesque", body: "Inter" },
    component: GymTemplate,
    sampleContent: sample("gym"),
  },

  general: {
    key: "general",
    name: "Local Pro",
    category: "General Business",
    description: "Versatile premium layout that fits any local business.",
    colorVariants: [
      light("indigo", "Indigo", "#4338ca", "#1e1b4b", "#f59e0b"),
      light("teal", "Teal", "#0f766e", "#042f2e", "#fb7185"),
      light("amber", "Amber", "#b45309", "#451a03", "#0f766e", { background: "#faf8f3" }),
      light("slate", "Graphite", "#1e293b", "#020617", "#0ea5e9"),
      dark("midnight", "Midnight", "#6366f1", "#1e1b4b", "#22d3ee"),
    ],
    layoutVariants: [
      { key: "classic", label: "Split hero" },
      { key: "compact", label: "Compact (cinematic)" },
    ],
    defaultFonts: { heading: "Outfit", body: "Plus Jakarta Sans" },
    component: GeneralTemplate,
    sampleContent: sample("general"),
  },
};

export const TEMPLATE_LIST: TemplateDefinition[] = Object.values(TEMPLATES);

export function getTemplate(key: string | null | undefined): TemplateDefinition {
  return (key && TEMPLATES[key]) || (TEMPLATES.general as TemplateDefinition);
}

export function getColorVariant(template: TemplateDefinition, key: string | null): ColorVariant {
  return (
    template.colorVariants.find((v) => v.key === key) ??
    (template.colorVariants[0] as ColorVariant)
  );
}

export function getLayoutVariant(template: TemplateDefinition, key: string | null): string {
  return (
    template.layoutVariants.find((v) => v.key === key)?.key ??
    (template.layoutVariants[0] as LayoutVariant).key
  );
}
