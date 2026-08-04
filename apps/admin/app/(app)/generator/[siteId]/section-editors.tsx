"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import type { SiteContent, SiteSectionKey } from "@aiwebsite/templates";
import { Button, Input, Label, NativeSelect, Textarea } from "@aiwebsite/ui";

/* Shared small building blocks ------------------------------------ */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label}>
      {rows ? (
        <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

function ArrayShell({
  onAdd,
  addLabel,
  children,
}: {
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {children}
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus />
        {addLabel}
      </Button>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
      aria-label="Remove item"
      onClick={onClick}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

const ICONS = [
  "sparkles", "tooth", "smile", "implant", "braces", "shield", "heart", "health",
  "stethoscope", "scissors", "brush", "dumbbell", "fitness", "food", "utensils",
  "camera", "wrench", "briefcase", "star", "clock",
];

/* Per-section editors ---------------------------------------------- */

type Setter<K extends SiteSectionKey> = (value: SiteContent[K]) => void;

function HeroEditor({ value, onChange }: { value: SiteContent["hero"]; onChange: Setter<"hero"> }) {
  const set = (patch: Partial<SiteContent["hero"]>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <Text label="Badge (small pill above title)" value={value.badge} onChange={(v) => set({ badge: v })} />
      <Text label="Title" value={value.title} onChange={(v) => set({ title: v })} />
      <Text label="Subtitle" rows={2} value={value.subtitle} onChange={(v) => set({ subtitle: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Text label="Primary CTA (WhatsApp)" value={value.ctaPrimary} onChange={(v) => set({ ctaPrimary: v })} />
        <Text label="Secondary CTA (Call)" value={value.ctaSecondary} onChange={(v) => set({ ctaSecondary: v })} />
      </div>
      <Text
        label="Hero image URL (optional — Media Library arrives in Phase 8)"
        value={value.image?.url ?? ""}
        onChange={(v) => set({ image: v ? { url: v, alt: value.image?.alt ?? "" } : null })}
      />
    </div>
  );
}

function AboutEditor({ value, onChange }: { value: SiteContent["about"]; onChange: Setter<"about"> }) {
  const set = (patch: Partial<SiteContent["about"]>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => set({ heading: v })} />
      <Text label="Body" rows={5} value={value.body} onChange={(v) => set({ body: v })} />
      <Field label="Highlights">
        <ArrayShell
          addLabel="Add highlight"
          onAdd={() => set({ highlights: [...value.highlights, ""] })}
        >
          {value.highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={h}
                onChange={(e) =>
                  set({ highlights: value.highlights.map((x, j) => (j === i ? e.target.value : x)) })
                }
              />
              <RemoveButton onClick={() => set({ highlights: value.highlights.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </ArrayShell>
      </Field>
    </div>
  );
}

function ServicesEditor({
  value,
  onChange,
}: {
  value: SiteContent["services"];
  onChange: Setter<"services">;
}) {
  const setItems = (items: SiteContent["services"]["items"]) => onChange({ ...value, items });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => onChange({ ...value, heading: v })} />
      <ArrayShell
        addLabel="Add service"
        onAdd={() => setItems([...value.items, { name: "", description: "", icon: "sparkles" }])}
      >
        {value.items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Service name"
                value={item.name}
                onChange={(e) =>
                  setItems(value.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <NativeSelect
                className="w-36"
                value={item.icon}
                onChange={(e) =>
                  setItems(value.items.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)))
                }
              >
                {ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </NativeSelect>
              <RemoveButton onClick={() => setItems(value.items.filter((_, j) => j !== i))} />
            </div>
            <Textarea
              rows={2}
              placeholder="One-line description"
              value={item.description}
              onChange={(e) =>
                setItems(
                  value.items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x))
                )
              }
            />
          </div>
        ))}
      </ArrayShell>
    </div>
  );
}

function WhyUsEditor({ value, onChange }: { value: SiteContent["whyUs"]; onChange: Setter<"whyUs"> }) {
  const setItems = (items: SiteContent["whyUs"]["items"]) => onChange({ ...value, items });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => onChange({ ...value, heading: v })} />
      <ArrayShell addLabel="Add point" onAdd={() => setItems([...value.items, { title: "", description: "" }])}>
        {value.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Title"
                value={item.title}
                onChange={(e) =>
                  setItems(value.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Description"
                value={item.description}
                onChange={(e) =>
                  setItems(
                    value.items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x))
                  )
                }
              />
            </div>
            <RemoveButton onClick={() => setItems(value.items.filter((_, j) => j !== i))} />
          </div>
        ))}
      </ArrayShell>
    </div>
  );
}

function TestimonialsEditor({
  value,
  onChange,
}: {
  value: SiteContent["testimonials"];
  onChange: Setter<"testimonials">;
}) {
  const setItems = (items: SiteContent["testimonials"]["items"]) => onChange({ ...value, items });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => onChange({ ...value, heading: v })} />
      <p className="text-xs text-muted-foreground">
        Always rendered with a “sample” disclaimer — never use real customer names.
      </p>
      <ArrayShell
        addLabel="Add testimonial"
        onAdd={() => setItems([...value.items, { name: "Happy Customer", text: "", rating: 5 }])}
      >
        {value.items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Generic name (e.g. Happy Customer)"
                value={item.name}
                onChange={(e) =>
                  setItems(value.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <NativeSelect
                className="w-24"
                value={String(item.rating)}
                onChange={(e) =>
                  setItems(
                    value.items.map((x, j) => (j === i ? { ...x, rating: Number(e.target.value) } : x))
                  )
                }
              >
                {[5, 4, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}★
                  </option>
                ))}
              </NativeSelect>
              <RemoveButton onClick={() => setItems(value.items.filter((_, j) => j !== i))} />
            </div>
            <Textarea
              rows={2}
              placeholder="Quote"
              value={item.text}
              onChange={(e) =>
                setItems(value.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
              }
            />
          </div>
        ))}
      </ArrayShell>
    </div>
  );
}

function FaqsEditor({ value, onChange }: { value: SiteContent["faqs"]; onChange: Setter<"faqs"> }) {
  const setItems = (items: SiteContent["faqs"]["items"]) => onChange({ ...value, items });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => onChange({ ...value, heading: v })} />
      <ArrayShell addLabel="Add FAQ" onAdd={() => setItems([...value.items, { q: "", a: "" }])}>
        {value.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Question"
                value={item.q}
                onChange={(e) =>
                  setItems(value.items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))
                }
              />
              <Textarea
                rows={2}
                placeholder="Answer"
                value={item.a}
                onChange={(e) =>
                  setItems(value.items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))
                }
              />
            </div>
            <RemoveButton onClick={() => setItems(value.items.filter((_, j) => j !== i))} />
          </div>
        ))}
      </ArrayShell>
    </div>
  );
}

function ReviewsEditor({
  value,
  onChange,
}: {
  value: SiteContent["reviews"];
  onChange: Setter<"reviews">;
}) {
  const setSnippets = (snippets: string[]) => onChange({ ...value, snippets });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => onChange({ ...value, heading: v })} />
      <Field label="Review snippets (short quotes from real Google reviews)">
        <ArrayShell addLabel="Add snippet" onAdd={() => setSnippets([...value.snippets, ""])}>
          {value.snippets.map((snippet, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={snippet}
                onChange={(e) => setSnippets(value.snippets.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <RemoveButton onClick={() => setSnippets(value.snippets.filter((_, j) => j !== i))} />
            </div>
          ))}
        </ArrayShell>
      </Field>
    </div>
  );
}

function CtaEditor({ value, onChange }: { value: SiteContent["cta"]; onChange: Setter<"cta"> }) {
  const set = (patch: Partial<SiteContent["cta"]>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => set({ heading: v })} />
      <Text label="Subheading" value={value.subheading} onChange={(v) => set({ subheading: v })} />
      <Text label="Button text" value={value.buttonText} onChange={(v) => set({ buttonText: v })} />
    </div>
  );
}

function ContactEditor({
  value,
  onChange,
}: {
  value: SiteContent["contact"];
  onChange: Setter<"contact">;
}) {
  const set = (patch: Partial<SiteContent["contact"]>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => set({ heading: v })} />
      <Text label="Note under heading" value={value.note} onChange={(v) => set({ note: v })} />
    </div>
  );
}

function GalleryEditor({
  value,
  onChange,
}: {
  value: SiteContent["gallery"];
  onChange: Setter<"gallery">;
}) {
  const setImages = (images: SiteContent["gallery"]["images"]) => onChange({ ...value, images });
  return (
    <div className="space-y-3">
      <Text label="Heading" value={value.heading} onChange={(v) => onChange({ ...value, heading: v })} />
      <Field label="Images (URLs — drag-drop upload arrives with the Media Library, Phase 8)">
        <ArrayShell addLabel="Add image" onAdd={() => setImages([...value.images, { url: "", alt: "" }])}>
          {value.images.map((image, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="https://…"
                value={image.url}
                onChange={(e) =>
                  setImages(value.images.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Alt text"
                className="w-40"
                value={image.alt}
                onChange={(e) =>
                  setImages(value.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))
                }
              />
              <RemoveButton onClick={() => setImages(value.images.filter((_, j) => j !== i))} />
            </div>
          ))}
        </ArrayShell>
      </Field>
    </div>
  );
}

function BusinessEditor({
  value,
  onChange,
}: {
  value: SiteContent["business"];
  onChange: Setter<"business">;
}) {
  const set = (patch: Partial<SiteContent["business"]>) => onChange({ ...value, ...patch });
  const setHours = (openingHours: SiteContent["business"]["openingHours"]) => set({ openingHours });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Text label="Business name" value={value.name} onChange={(v) => set({ name: v })} />
        <Text label="Category" value={value.category} onChange={(v) => set({ category: v })} />
        <Text label="Phone" value={value.phone} onChange={(v) => set({ phone: v })} />
        <Text label="WhatsApp" value={value.whatsapp} onChange={(v) => set({ whatsapp: v })} />
        <Text label="Email" value={value.email} onChange={(v) => set({ email: v })} />
        <Text label="Area" value={value.area} onChange={(v) => set({ area: v })} />
      </div>
      <Text label="Address" value={value.address} onChange={(v) => set({ address: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Text label="Google Maps link" value={value.mapUrl} onChange={(v) => set({ mapUrl: v })} />
        <Text label="Maps embed URL" value={value.mapEmbedUrl} onChange={(v) => set({ mapEmbedUrl: v })} />
        <Text label="Instagram" value={value.socials.instagram} onChange={(v) => set({ socials: { ...value.socials, instagram: v } })} />
        <Text label="Facebook" value={value.socials.facebook} onChange={(v) => set({ socials: { ...value.socials, facebook: v } })} />
      </div>
      <Field label="Opening hours">
        <ArrayShell addLabel="Add row" onAdd={() => setHours([...value.openingHours, { days: "", hours: "" }])}>
          {value.openingHours.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Mon – Sat"
                value={slot.days}
                onChange={(e) =>
                  setHours(value.openingHours.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))
                }
              />
              <Input
                placeholder="10:00 AM – 8:30 PM"
                value={slot.hours}
                onChange={(e) =>
                  setHours(value.openingHours.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))
                }
              />
              <RemoveButton onClick={() => setHours(value.openingHours.filter((_, j) => j !== i))} />
            </div>
          ))}
        </ArrayShell>
      </Field>
    </div>
  );
}

function MetaEditor({ value, onChange }: { value: SiteContent["meta"]; onChange: Setter<"meta"> }) {
  const set = (patch: Partial<SiteContent["meta"]>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <Text label={`SEO title (${value.title.length}/70)`} value={value.title} onChange={(v) => set({ title: v })} />
      <Text
        label={`Meta description (${value.description.length}/200)`}
        rows={3}
        value={value.description}
        onChange={(v) => set({ description: v })}
      />
      <Text
        label="Keywords (comma separated)"
        value={value.keywords.join(", ")}
        onChange={(v) => set({ keywords: v.split(",").map((k) => k.trim()).filter(Boolean) })}
      />
    </div>
  );
}

function FooterEditor({ value, onChange }: { value: SiteContent["footer"]; onChange: Setter<"footer"> }) {
  return <Text label="Tagline" value={value.tagline} onChange={(v) => onChange({ tagline: v })} />;
}

/* Dispatcher -------------------------------------------------------- */

export function SectionFields({
  sectionKey,
  content,
  onSectionChange,
}: {
  sectionKey: SiteSectionKey;
  content: SiteContent;
  onSectionChange: <K extends SiteSectionKey>(key: K, value: SiteContent[K]) => void;
}) {
  switch (sectionKey) {
    case "hero":
      return <HeroEditor value={content.hero} onChange={(v) => onSectionChange("hero", v)} />;
    case "about":
      return <AboutEditor value={content.about} onChange={(v) => onSectionChange("about", v)} />;
    case "services":
      return <ServicesEditor value={content.services} onChange={(v) => onSectionChange("services", v)} />;
    case "whyUs":
      return <WhyUsEditor value={content.whyUs} onChange={(v) => onSectionChange("whyUs", v)} />;
    case "testimonials":
      return (
        <TestimonialsEditor value={content.testimonials} onChange={(v) => onSectionChange("testimonials", v)} />
      );
    case "faqs":
      return <FaqsEditor value={content.faqs} onChange={(v) => onSectionChange("faqs", v)} />;
    case "reviews":
      return <ReviewsEditor value={content.reviews} onChange={(v) => onSectionChange("reviews", v)} />;
    case "cta":
      return <CtaEditor value={content.cta} onChange={(v) => onSectionChange("cta", v)} />;
    case "contact":
      return <ContactEditor value={content.contact} onChange={(v) => onSectionChange("contact", v)} />;
    case "gallery":
      return <GalleryEditor value={content.gallery} onChange={(v) => onSectionChange("gallery", v)} />;
    case "business":
      return <BusinessEditor value={content.business} onChange={(v) => onSectionChange("business", v)} />;
    case "meta":
      return <MetaEditor value={content.meta} onChange={(v) => onSectionChange("meta", v)} />;
    case "footer":
      return <FooterEditor value={content.footer} onChange={(v) => onSectionChange("footer", v)} />;
  }
}
