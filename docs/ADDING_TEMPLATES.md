# Adding a website template

**Companion docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [RUNBOOK.md](./RUNBOOK.md)

A template is a typed React component that renders `SiteContent` — the same validated shape the
AI generator produces, the section editor edits, and version history stores. Because every
template consumes the identical contract, adding one is mechanical: no AI prompt changes, no
renderer changes, no editor changes.

---

## 1. What a template actually is

```
packages/templates/src/templates/<key>.tsx   ← the component (this is the only new file)
packages/templates/src/registry.tsx           ← one new entry (TEMPLATES object)
supabase/migrations/00NN_*.sql                ← one new row in aiwebsite_templates
```

A template component has this exact signature (`packages/templates/src/types.ts`):

```typescript
export interface TemplateProps {
  content: SiteContent;        // validated AI-generated (or hand-edited) copy
  branding: ResolvedBranding;   // resolved color variant + fonts for this render
  layout: string;               // one of this template's layoutVariants keys
  demo: DemoInfo;                // demo banner state — passed through, not decided here
}
```

It composes pre-built section components from `packages/templates/src/components/sections.tsx`
(`Hero`, `ServicesSection`, `AboutSection`, `GallerySection`, `ReviewsSection`,
`TestimonialsSection`, `FaqsSection`, `WhyUsSection`, `CtaBand`, `ContactSection`, `SiteHeader`,
`SiteFooter`, `SiteShell`) — a template's job is **which sections, in what order, with what
layout variant**, not building new markup per business. This is what keeps every demo
visually distinct without the AI ever touching layout.

---

## 2. Step-by-step

### 2.1 Create the component

Copy the closest existing template as a starting point (`dental.tsx` for a services-led business,
`restaurant.tsx` for a dark/appetite-driven one, `general.tsx` as the safest default) and adjust
the section order/layout:

```tsx
// packages/templates/src/templates/clinic-modern.tsx
import {
  AboutSection, ContactSection, CtaBand, FaqsSection, Hero,
  ReviewsSection, ServicesSection, SiteFooter, SiteHeader, SiteShell,
  TestimonialsSection, WhyUsSection,
} from "../components/sections";
import type { TemplateProps } from "../types";

/**
 * Modern Clinic — trust-first: reviews before services, no gallery.
 * Layouts: "classic" (centered hero) | "compact" (no WhyUs band).
 */
export function ClinicModernTemplate({ content, branding, layout, demo }: TemplateProps) {
  return (
    <SiteShell content={content} branding={branding} demo={demo}>
      <SiteHeader content={content} />
      <main>
        <Hero content={content} layout={layout === "compact" ? "classic" : "split"} />
        <ReviewsSection content={content} />
        <ServicesSection content={content} />
        <AboutSection content={content} />
        {layout !== "compact" && <WhyUsSection content={content} />}
        <TestimonialsSection content={content} />
        <FaqsSection content={content} />
        <CtaBand content={content} />
        <ContactSection content={content} />
      </main>
      <SiteFooter content={content} />
    </SiteShell>
  );
}
```

Don't invent new section components unless the design genuinely needs a new *kind* of content
block (see §4). Reordering, conditionally including, and passing a different `layout` prop to
existing sections covers the large majority of template variety.

### 2.2 Register it

Add one entry to `TEMPLATES` in `packages/templates/src/registry.tsx`:

```typescript
"clinic-modern": {
  key: "clinic-modern",
  name: "Modern Clinic",
  category: "Dental Clinic",         // must match a BUSINESS_CATEGORIES entry (packages/config)
  description: "Trust-first layout — reviews above the fold, no gallery clutter.",
  colorVariants: [
    light("teal", "Teal", "#0d9488", "#134e4a", "#f59e0b"),
    light("navy", "Navy", "#1e3a8a", "#0f172a", "#f97316"),
  ],
  layoutVariants: [
    { key: "classic", label: "Classic (centered hero)" },
    { key: "compact", label: "Compact (no trust band)" },
  ],
  defaultFonts: { heading: "Poppins", body: "Inter" },
  component: ClinicModernTemplate,
  sampleContent: sample("clinic-modern"),
},
```

- `key` — lowercase, hyphenated, must be unique, and must exactly match the `key` column you
  insert into `aiwebsite_templates` (§2.3) — this is the join between the DB row and the
  component.
- `colorVariants` — use the `light(...)` / `dark(...)` helpers already in the file (defined at
  the top of `registry.tsx`) rather than hand-writing the full `ColorVariant` object; pick 2–4
  palettes that make sense for the category.
- `sampleContent` — add a matching entry to `SAMPLE_CONTENT` in `sample-content.ts` (used by the
  admin's template preview page, `/templates/<key>`, before any real lead has generated content
  with this template). Testimonials in sample content must be clearly fictional/generic — never
  named as if they were a real client (same rule applies to AI-generated testimonials).

### 2.3 Add the database row

Add a migration (`supabase/migrations/00NN_add_clinic_modern_template.sql`):

```sql
insert into public.aiwebsite_templates (id, key, name, category, description, color_variants, layout_variants, sort_order)
values (
  gen_random_uuid(), 'clinic-modern', 'Modern Clinic', 'Dental Clinic',
  'Trust-first layout — reviews above the fold, no gallery clutter.',
  '["teal","navy"]', '["classic","compact"]', 6
)
on conflict (key) do nothing;
```

Then append the same statement to `supabase/APPLY_ALL.sql` (before the `SEED` section — see
`RUNBOOK.md` §3) and run it against your Supabase project.

`color_variants`/`layout_variants` in the DB row are just the *keys*, used by the generator
wizard's dropdowns before the full `TemplateDefinition` is loaded — they must list the same keys
as `registry.tsx`'s `colorVariants`/`layoutVariants`, or the wizard will offer a variant the
component doesn't actually define.

---

## 3. Verifying it

1. `/templates/clinic-modern` in the admin app renders the sample content through the real
   component — check every color variant and layout variant looks right, in both dark and light
   *admin* theme (the template's own light/dark-ness from `light()`/`dark()` is separate from the
   admin dashboard's theme toggle — don't confuse the two).
2. Generate a real demo against a lead in the matching category and confirm the AI-generated
   `SiteContent` renders correctly — this is the real integration test, since sample content is
   hand-picked to look good and won't catch a section that breaks on shorter/longer AI copy.
3. Resize to mobile width — every section component already handles responsiveness, but a new
   section order can still produce awkward spacing worth a visual check.
4. Run `npm run build` and `npm run typecheck` — `packages/templates` has no test suite of its
   own; a clean typecheck is the correctness bar for the registry entry's shape.

---

## 4. Adding a genuinely new section type

Only needed if no existing section in `sections.tsx` fits (rare — the existing set covers hero,
services, about, gallery, reviews, testimonials, FAQs, a CTA band, and contact). If you do need
one:

1. Add the new section's fields to the `SiteContent` Zod schema (`packages/templates/src/schema.ts`)
   as **optional** — every existing site's stored content must remain valid against the updated
   schema without a migration.
2. Add the section component to `sections.tsx`, following the existing components' prop shape
   (`{ content: SiteContent }`, reading only its own slice of `content`).
3. Update the AI generation prompt(s) in the `aiwebsite_prompt_templates` table (Settings →
   Prompts) for any category that should populate the new field — otherwise it'll just render
   empty/omitted for existing categories, which is safe but pointless.
4. Update `sample-content.ts` for every template whose sample content should show it off.

Because `SiteContent` is the single contract (ARCHITECTURE.md ADR-3), this is the only path that
touches the AI generator, the section editor, and the renderer at once — everywhere else, adding
a template is purely additive and isolated to the three steps in §2.
