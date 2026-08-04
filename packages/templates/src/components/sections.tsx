import * as React from "react";
import clsx from "clsx";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Briefcase,
  Brush,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Dumbbell,
  Facebook,
  HeartPulse,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Quote,
  Scissors,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { brandingStyle, googleFontsHref, type ResolvedBranding } from "../branding";
import { GalleryGrid } from "./gallery-lightbox";
import { HeroCarousel } from "./hero-carousel";
import { optimizeImage } from "../media";
import type { SiteContent } from "../schema";

/** Combines hero.image + gallery.images into a deduped list for the hero carousel. */
function heroCarouselImages(
  hero: { url: string; alt: string } | null,
  gallery: { url: string; alt: string }[]
): { url: string; alt: string }[] {
  const seen = new Set<string>();
  const result: { url: string; alt: string }[] = [];
  for (const image of [hero, ...gallery]) {
    if (!image?.url || seen.has(image.url)) continue;
    seen.add(image.url);
    result.push(image);
  }
  return result.slice(0, 8);
}

/**
 * Premium section library — every generated site is composed from these.
 *
 * Design principles:
 *  - Editorial scale: oversized display type, generous whitespace, hairlines
 *    instead of heavy borders, one accent gradient per page.
 *  - Depth without noise: glass surfaces, gradient edges, soft elevation.
 *  - Motion is scroll-linked and CSS-only (see apps/sites/app/globals.css)
 *    so every template stays a pure Server Component — zero client JS.
 *  - Colour comes exclusively from --site-* tokens, so one palette swap
 *    restyles the whole site (light or dark) with no per-section overrides.
 */

// ── Icon vocabulary (AI outputs a key; unknown keys fall back) ───────

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  tooth: Smile,
  smile: Smile,
  implant: ShieldCheck,
  braces: Award,
  shield: ShieldCheck,
  heart: HeartPulse,
  health: Stethoscope,
  stethoscope: Stethoscope,
  scissors: Scissors,
  brush: Brush,
  dumbbell: Dumbbell,
  fitness: Dumbbell,
  food: UtensilsCrossed,
  utensils: UtensilsCrossed,
  camera: Camera,
  wrench: Wrench,
  briefcase: Briefcase,
  star: Star,
  clock: Clock,
};

export function iconFor(key: string): LucideIcon {
  return ICONS[key.toLowerCase()] ?? Sparkles;
}

export function waHref(number: string, text?: string): string {
  const digits = number.replace(/[^0-9]/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

export interface DemoInfo {
  enabled: boolean;
  agencyName: string;
  agencyWhatsapp: string;
  expiresAt: string | null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Layout primitives ────────────────────────────────────────────────

function Container({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={clsx(
        "mx-auto w-full px-5 sm:px-8",
        wide ? "max-w-[88rem]" : "max-w-6xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Section({
  id,
  children,
  className,
  tone = "base",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  /** base = page background, raised = surface panel, sunken = brand-tinted band */
  tone?: "base" | "raised" | "sunken";
}) {
  return (
    <section
      id={id}
      className={clsx(
        "relative scroll-mt-24 py-20 sm:py-28",
        tone === "raised" && "bg-surface",
        tone === "sunken" &&
          "bg-[color-mix(in_srgb,var(--site-primary)_5%,var(--site-background))]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <span
      className={clsx(
        "eyebrow inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-brand",
        "bg-[color-mix(in_srgb,var(--site-primary)_9%,transparent)]",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      {children}
    </span>
  );
}

export function SectionHeading({
  children,
  sub,
  eyebrow,
  align = "center",
  /** @deprecated colour now comes from tokens; kept for template compatibility */
  dark: _dark,
}: {
  children: React.ReactNode;
  sub?: string;
  eyebrow?: string;
  align?: "center" | "left";
  dark?: boolean;
}) {
  return (
    <div
      className={clsx(
        "reveal mb-14 flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left"
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="display-sm text-ink">{children}</h2>
      {sub && (
        <p className={clsx("lede max-w-2xl text-ink-muted", align === "center" && "mx-auto")}>
          {sub}
        </p>
      )}
      <span
        className={clsx(
          "h-px w-24",
          align === "center"
            ? "bg-gradient-to-r from-transparent via-brand to-transparent"
            : "bg-gradient-to-r from-brand to-transparent"
        )}
      />
    </div>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────

function PrimaryButton({
  href,
  children,
  icon: Icon = MessageCircle,
  external,
  className,
}: {
  href: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  external?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={clsx(
        "group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full px-7 py-3.5",
        "font-semibold text-brand-foreground shadow-[var(--shadow-lift)]",
        "transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]",
        className
      )}
      style={{
        backgroundImage:
          "linear-gradient(135deg, var(--site-primary) 0%, color-mix(in srgb, var(--site-primary) 62%, var(--site-accent)) 100%)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-[900ms] group-hover:translate-x-full"
      />
      <Icon className="relative h-[18px] w-[18px]" />
      <span className="relative">{children}</span>
    </a>
  );
}

function GhostButton({
  href,
  children,
  icon: Icon,
  onDark,
  className,
}: {
  href: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={clsx(
        "inline-flex items-center gap-2.5 rounded-full border px-7 py-3.5 font-semibold backdrop-blur",
        "transition-colors duration-300",
        onDark
          ? "border-white/25 text-white hover:border-white/50 hover:bg-white/10"
          : "border-hairline text-ink hover:border-brand/40 hover:bg-[color-mix(in_srgb,var(--site-primary)_7%,transparent)]",
        className
      )}
    >
      {Icon && <Icon className="h-[18px] w-[18px]" />}
      {children}
    </a>
  );
}

// ── Shell: tokens + fonts + demo banner + WhatsApp dock ──────────────

export function SiteShell({
  content,
  branding,
  demo,
  children,
}: {
  content: SiteContent;
  branding: ResolvedBranding;
  demo: DemoInfo;
  children: React.ReactNode;
}) {
  const b = content.business;
  return (
    <div
      style={brandingStyle(branding) as React.CSSProperties}
      className="site-root relative min-h-screen overflow-x-clip bg-site font-body text-ink antialiased"
    >
      <link
        rel="stylesheet"
        precedence="default"
        href={googleFontsHref([branding.fontHeading, branding.fontBody])}
      />
      <span aria-hidden className="grain pointer-events-none fixed inset-0 z-[60]" />
      {demo.enabled && <DemoBanner demo={demo} businessName={b.name} />}
      {children}
      {b.whatsapp && <WhatsAppDock business={b} />}
    </div>
  );
}

function WhatsAppDock({ business }: { business: SiteContent["business"] }) {
  return (
    <a
      href={waHref(
        business.whatsapp,
        `Hi ${business.name}, I found your website and would like to know more.`
      )}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="group fixed bottom-6 right-5 z-50 flex items-center rounded-full bg-[#25D366] px-4 text-white shadow-[0_12px_40px_-8px_rgba(37,211,102,.6)] transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] hover:pr-6 sm:bottom-8 sm:right-8"
    >
      <span aria-hidden className="pulse-ring absolute inset-0 rounded-full" />
      <span className="relative flex h-14 items-center gap-0 group-hover:gap-2.5">
        <MessageCircle className="h-6 w-6 shrink-0" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-500 group-hover:max-w-[9rem] group-hover:opacity-100">
          Chat with us
        </span>
      </span>
    </a>
  );
}

function DemoBanner({ demo, businessName }: { demo: DemoInfo; businessName: string }) {
  const daysLeft = demo.expiresAt
    ? Math.max(0, Math.ceil((new Date(demo.expiresAt).getTime() - Date.now()) / 86400_000))
    : null;
  return (
    <div className="relative z-50 border-b border-white/10 bg-[#0b0b0f] text-zinc-200">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2 text-center text-[13px]">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          Demo website crafted by{" "}
          <strong className="font-semibold text-white">{demo.agencyName}</strong>
          {daysLeft !== null && daysLeft <= 7 && (
            <span className="text-amber-300">
              · expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}
            </span>
          )}
        </span>
        {demo.agencyWhatsapp && (
          <a
            href={waHref(
              demo.agencyWhatsapp,
              `Hi! I'm interested in the ${businessName} demo website.`
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white transition-transform hover:scale-105"
          >
            Claim this site <ArrowRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
}

/**
 * Nav is derived from content so we never link to a section that a given
 * business didn't produce (e.g. no photos → no #gallery anchor).
 */
function navFor(content: SiteContent): NavItem[] {
  const items: NavItem[] = [
    { label: "About", href: "#about" },
    { label: "Services", href: "#services" },
  ];
  if (content.gallery.images.some((i) => i.url)) items.push({ label: "Gallery", href: "#gallery" });
  if (content.business.rating !== null || content.reviews.snippets.length > 0)
    items.push({ label: "Reviews", href: "#reviews" });
  if (content.faqs.items.length > 0) items.push({ label: "FAQs", href: "#faqs" });
  items.push({ label: "Contact", href: "#contact" });
  return items;
}

export function SiteHeader({
  content,
  variant = "light",
  floating = true,
}: {
  content: SiteContent;
  variant?: "light" | "dark";
  /** Floating pill header (default) vs. full-width bar. */
  floating?: boolean;
}) {
  const b = content.business;
  const onDark = variant === "dark";
  const nav = navFor(content);

  return (
    <header
      className={clsx(
        "sticky top-0 z-40",
        floating ? "px-3 pt-3 sm:px-6 sm:pt-5" : "border-b border-hairline"
      )}
    >
      <div
        className={clsx(
          "mx-auto flex items-center justify-between gap-4",
          onDark ? "glass-dark text-white" : "glass text-ink",
          floating
            ? "max-w-[76rem] rounded-full border border-hairline px-3 py-2.5 shadow-[var(--shadow-lift)] sm:px-4"
            : "max-w-[88rem] px-5 py-3.5 sm:px-8"
        )}
      >
        <a href="#top" className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading text-[13px] font-bold tracking-tight text-brand-foreground shadow-[var(--shadow-lift)]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--site-primary), color-mix(in srgb, var(--site-primary) 55%, var(--site-accent)))",
            }}
          >
            {initials(b.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-[17px] font-semibold leading-tight tracking-tight">
              {b.name}
            </span>
            {b.category && (
              <span className="hidden truncate text-[11px] uppercase tracking-[0.16em] opacity-55 sm:block">
                {b.category}
              </span>
            )}
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Site">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-[14px] font-medium opacity-70 transition-all duration-300 hover:bg-[color-mix(in_srgb,var(--site-primary)_10%,transparent)] hover:opacity-100"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {b.phone && (
            <a
              href={`tel:${b.phone}`}
              className="hidden items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold opacity-75 transition-opacity hover:opacity-100 md:inline-flex"
            >
              <Phone className="h-4 w-4" />
              <span className="tnum">{b.phone}</span>
            </a>
          )}
          {b.whatsapp && (
            <a
              href={waHref(b.whatsapp, `Hi ${b.name}!`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-[var(--shadow-lift)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              <span className="hidden sm:inline">Book Now</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
          <MobileNav nav={nav} onDark={onDark} phone={b.phone} />
        </div>
      </div>
    </header>
  );
}

/** JS-free mobile menu built on <details>. */
function MobileNav({ nav, onDark, phone }: { nav: NavItem[]; onDark: boolean; phone: string }) {
  return (
    <details className="relative lg:hidden">
      <summary
        aria-label="Menu"
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-hairline transition-colors hover:bg-[color-mix(in_srgb,var(--site-primary)_10%,transparent)] [&::-webkit-details-marker]:hidden"
      >
        <span className="flex flex-col gap-[5px]">
          <span className="block h-[1.5px] w-4 rounded bg-current" />
          <span className="block h-[1.5px] w-4 rounded bg-current" />
          <span className="block h-[1.5px] w-2.5 rounded bg-current" />
        </span>
      </summary>
      <div
        className={clsx(
          "absolute right-0 top-12 w-56 origin-top-right rounded-2xl border border-hairline p-2 shadow-[var(--shadow-float)]",
          onDark ? "glass-dark" : "glass"
        )}
      >
        {nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--site-primary)_10%,transparent)]"
          >
            {item.label}
            <ArrowUpRight className="h-3.5 w-3.5 opacity-40" />
          </a>
        ))}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="mt-1 flex items-center gap-2 rounded-xl bg-brand px-3.5 py-2.5 text-sm font-semibold text-brand-foreground"
          >
            <Phone className="h-4 w-4" /> Call now
          </a>
        )}
      </div>
    </details>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────

export type HeroLayout = "classic" | "split" | "cinematic";

export function Hero({
  content,
  layout = "cinematic",
  dark,
}: {
  content: SiteContent;
  layout?: HeroLayout;
  dark?: boolean;
}) {
  if (layout === "split") return <HeroSplit content={content} />;
  if (layout === "classic") return <HeroCentered content={content} dark={dark} />;
  return <HeroCinematic content={content} dark={dark} />;
}

function HeroActions({
  content,
  onDark,
  center,
}: {
  content: SiteContent;
  onDark?: boolean;
  center?: boolean;
}) {
  const { hero, business } = content;
  return (
    <div className={clsx("flex flex-wrap items-center gap-3", center && "justify-center")}>
      {business.whatsapp ? (
        <PrimaryButton
          href={waHref(business.whatsapp, `Hi ${business.name}!`)}
          external
          className="rise [animation-delay:.25s]"
        >
          {hero.ctaPrimary}
        </PrimaryButton>
      ) : (
        business.phone && (
          <PrimaryButton
            href={`tel:${business.phone}`}
            icon={Phone}
            className="rise [animation-delay:.25s]"
          >
            {hero.ctaPrimary}
          </PrimaryButton>
        )
      )}
      {hero.ctaSecondary && business.phone && (
        <GhostButton
          href={`tel:${business.phone}`}
          icon={Phone}
          onDark={onDark}
          className="rise [animation-delay:.32s]"
        >
          {hero.ctaSecondary}
        </GhostButton>
      )}
    </div>
  );
}

function RatingPill({ content, onDark }: { content: SiteContent; onDark?: boolean }) {
  const { business } = content;
  if (business.rating === null) return null;
  return (
    <div
      className={clsx(
        "rise inline-flex items-center gap-3 rounded-full border px-4 py-2 backdrop-blur [animation-delay:.4s]",
        onDark
          ? "border-white/15 bg-white/10 text-white"
          : "border-hairline bg-surface text-ink shadow-[var(--shadow-lift)]"
      )}
    >
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={clsx(
              "h-4 w-4",
              n <= Math.round(business.rating ?? 0)
                ? "fill-amber-400 text-amber-400"
                : onDark
                  ? "text-white/25"
                  : "text-ink/15"
            )}
          />
        ))}
      </span>
      <span className="text-sm">
        <strong className="tnum font-semibold">{business.rating.toFixed(1)}</strong>
        {business.reviewCount !== null && (
          <span className="opacity-65"> · {business.reviewCount} Google reviews</span>
        )}
      </span>
    </div>
  );
}

function HeroCinematic({ content, dark }: { content: SiteContent; dark?: boolean }) {
  const { hero, business, gallery } = content;
  const images = heroCarouselImages(hero.image, gallery.images);
  const onDark = images.length > 0 || dark;

  return (
    <section id="top" className="relative isolate -mt-[4.5rem] overflow-hidden pt-[4.5rem]">
      {images.length > 0 ? (
        <HeroCarousel images={images} fallbackAlt={business.name} />
      ) : (
        <>
          <span aria-hidden className="aurora -z-20" />
          <span aria-hidden className="grid-lines -z-10" />
        </>
      )}

      <Container className="relative flex min-h-[86svh] flex-col justify-center py-24 sm:py-32">
        <div className="max-w-4xl">
          {hero.badge && (
            <span
              className={clsx(
                "rise eyebrow mb-7 inline-flex items-center gap-2 rounded-full border px-4 py-2 backdrop-blur",
                onDark
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-hairline bg-surface/70 text-brand"
              )}
            >
              <Sparkles className="h-3 w-3" />
              {hero.badge}
            </span>
          )}
          <h1 className={clsx("rise display [animation-delay:.08s]", onDark ? "text-white" : "text-ink")}>
            {hero.title}
          </h1>
          {hero.subtitle && (
            <p
              className={clsx(
                "rise lede mt-7 max-w-2xl [animation-delay:.16s]",
                onDark ? "text-white/80" : "text-ink-muted"
              )}
            >
              {hero.subtitle}
            </p>
          )}
          <div className="mt-10">
            <HeroActions content={content} onDark={onDark} />
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <RatingPill content={content} onDark={onDark} />
            {(business.area || business.city) && (
              <span
                className={clsx(
                  "rise inline-flex items-center gap-2 text-sm [animation-delay:.45s]",
                  onDark ? "text-white/70" : "text-ink-muted"
                )}
              >
                <MapPin className="h-4 w-4" />
                {[business.area, business.city].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function HeroSplit({ content }: { content: SiteContent }) {
  const { hero, business, gallery } = content;
  const images = heroCarouselImages(hero.image, gallery.images);
  return (
    <section id="top" className="relative isolate overflow-hidden">
      <span aria-hidden className="aurora aurora-soft -z-20" />
      <Container wide className="relative">
        <div className="grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
          <div>
            {hero.badge && (
              <span className="rise mb-7 inline-block">
                <Eyebrow>{hero.badge}</Eyebrow>
              </span>
            )}
            <h1 className="rise display text-ink [animation-delay:.08s]">{hero.title}</h1>
            {hero.subtitle && (
              <p className="rise lede mt-7 max-w-xl text-ink-muted [animation-delay:.16s]">
                {hero.subtitle}
              </p>
            )}
            <div className="mt-10">
              <HeroActions content={content} />
            </div>
            <div className="mt-9">
              <RatingPill content={content} />
            </div>
          </div>

          <div className="rise relative [animation-delay:.3s]">
            <div className="zoomable edge relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-float)]">
              {images.length > 0 ? (
                <HeroCarousel images={images} fallbackAlt={business.name} scrim={false} />
              ) : (
                <div className="brand-wash flex h-full w-full items-center justify-center p-10">
                  <span className="display-sm text-center text-white/95">{business.name}</span>
                </div>
              )}
            </div>
            {business.rating !== null && (
              <div className="glass absolute -bottom-6 -left-6 hidden w-52 rounded-2xl border border-hairline p-5 shadow-[var(--shadow-float)] sm:block">
                <p className="tnum font-heading text-4xl font-bold leading-none text-ink">
                  {business.rating.toFixed(1)}
                </p>
                <div className="mt-2 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={clsx(
                        "h-3.5 w-3.5",
                        n <= Math.round(business.rating ?? 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-ink/15"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">
                  {business.reviewCount !== null
                    ? `${business.reviewCount} Google reviews`
                    : "Google rated"}
                </p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function HeroCentered({ content, dark }: { content: SiteContent; dark?: boolean }) {
  const { hero, business, gallery } = content;
  const images = heroCarouselImages(hero.image, gallery.images);
  return (
    <section id="top" className="relative isolate overflow-hidden">
      <span aria-hidden className="aurora -z-20" />
      <span aria-hidden className="grid-lines -z-10" />
      <Container className="relative py-24 text-center sm:py-36">
        {hero.badge && (
          <span className="rise mb-7 inline-block">
            <Eyebrow>{hero.badge}</Eyebrow>
          </span>
        )}
        <h1
          className={clsx(
            "rise display mx-auto max-w-5xl [animation-delay:.08s]",
            dark ? "text-white" : "text-ink"
          )}
        >
          {hero.title}
        </h1>
        {hero.subtitle && (
          <p
            className={clsx(
              "rise lede mx-auto mt-7 max-w-2xl [animation-delay:.16s]",
              dark ? "text-white/75" : "text-ink-muted"
            )}
          >
            {hero.subtitle}
          </p>
        )}
        <div className="mt-11">
          <HeroActions content={content} onDark={dark} center />
        </div>
        <div className="mt-9 flex justify-center">
          <RatingPill content={content} onDark={dark} />
        </div>

        {images.length > 0 && (
          <div className="rise zoomable edge relative mx-auto mt-20 aspect-[16/8] max-w-5xl overflow-hidden rounded-[2rem] shadow-[var(--shadow-float)] [animation-delay:.4s]">
            <HeroCarousel images={images} fallbackAlt={business.name} scrim={false} />
          </div>
        )}
      </Container>
    </section>
  );
}

// ── Trust marquee ────────────────────────────────────────────────────

export function TrustMarquee({ content }: { content: SiteContent }) {
  const { business, services, about } = content;
  const items = [
    business.rating !== null ? `★ ${business.rating.toFixed(1)} Google rating` : null,
    business.reviewCount ? `${business.reviewCount}+ happy customers` : null,
    ...about.highlights.slice(0, 3),
    ...services.items.slice(0, 5).map((s) => s.name),
    [business.area, business.city].filter(Boolean).join(", ") || null,
  ].filter(Boolean) as string[];

  if (items.length < 3) return null;
  const loop = [...items, ...items];

  return (
    <div className="relative z-10 border-y border-hairline bg-surface py-4">
      <div className="marquee-mask overflow-hidden">
        <div className="marquee-track">
          {loop.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="flex shrink-0 items-center gap-8 px-8 text-sm font-medium uppercase tracking-[0.14em] text-ink-muted"
            >
              {item}
              <span className="h-1 w-1 rounded-full bg-brand" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── About (editorial split + floating hours card) ────────────────────

export function AboutSection({ content, dark: _dark }: { content: SiteContent; dark?: boolean }) {
  const { about, business } = content;
  const highlights = about.highlights.slice(0, 4);

  return (
    <Section id="about">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <div className="reveal">
            <div className="zoomable edge relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]">
              {about.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizeImage(about.image.url, 1200)}
                  alt={about.image.alt || about.heading}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="brand-wash relative h-full w-full">
                  <span aria-hidden className="grain absolute inset-0" />
                </div>
              )}
            </div>
            {business.openingHours.length > 0 && (
              <div className="glass relative z-10 -mt-12 ml-6 mr-[-1rem] rounded-2xl border border-hairline p-5 shadow-[var(--shadow-float)] sm:ml-10">
                <p className="eyebrow mb-2 flex items-center gap-2 text-brand">
                  <Clock className="h-3.5 w-3.5" /> Open Hours
                </p>
                {business.openingHours.slice(0, 2).map((slot) => (
                  <p key={slot.days} className="flex justify-between gap-4 py-0.5 text-sm">
                    <span className="text-ink-muted">{slot.days}</span>
                    <span className="tnum font-medium text-ink">{slot.hours}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="reveal">
            <SectionHeading align="left" eyebrow="Who we are">
              {about.heading}
            </SectionHeading>
            <p className="lede -mt-8 whitespace-pre-line text-ink-muted">{about.body}</p>

            {highlights.length > 0 && (
              <ul className="mt-10 grid gap-3 sm:grid-cols-2">
                {highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-start gap-3 rounded-2xl border border-hairline bg-surface p-4 transition-colors duration-300 hover:border-brand/35"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-sm font-medium leading-relaxed text-ink">{h}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}

// ── Stats band ───────────────────────────────────────────────────────

export function StatsBand({ content }: { content: SiteContent }) {
  const { business, services, whyUs } = content;
  const stats = [
    business.rating !== null ? { value: business.rating.toFixed(1), label: "Google rating" } : null,
    business.reviewCount ? { value: `${business.reviewCount}+`, label: "Verified reviews" } : null,
    services.items.length ? { value: `${services.items.length}`, label: "Services offered" } : null,
    whyUs.items.length ? { value: `${whyUs.items.length}`, label: "Reasons to choose us" } : null,
  ].filter(Boolean) as { value: string; label: string }[];

  if (stats.length < 3) return null;

  return (
    <Section tone="raised" className="!py-16">
      <Container>
        <div className="reveal grid divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {stats.map((s) => (
            <div key={s.label} className="px-6 py-7 text-center">
              <p
                className="tnum bg-clip-text font-heading text-5xl font-bold leading-none tracking-tight text-transparent sm:text-6xl"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--site-primary), color-mix(in srgb, var(--site-primary) 50%, var(--site-accent)))",
                }}
              >
                {s.value}
              </p>
              <p className="eyebrow mt-3 text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

// ── Services ─────────────────────────────────────────────────────────

export function ServicesSection({
  content,
  dark: _dark,
  style = "cards",
}: {
  content: SiteContent;
  dark?: boolean;
  style?: "cards" | "list";
}) {
  const { services, business } = content;

  return (
    <Section id="services" tone={style === "cards" ? "sunken" : "raised"}>
      <Container>
        <SectionHeading eyebrow="What we do" sub={`Everything ${business.name} offers, under one roof.`}>
          {services.heading}
        </SectionHeading>

        {style === "cards" ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.items.map((service, i) => {
              const Icon = iconFor(service.icon);
              return (
                <article
                  key={service.name}
                  className="reveal edge lift group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-hairline bg-surface p-8"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-40"
                    style={{ background: "var(--site-primary)" }}
                  />
                  <div className="relative mb-7 flex items-start justify-between">
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-brand"
                      style={{ background: "color-mix(in srgb, var(--site-primary) 11%, transparent)" }}
                    >
                      <Icon className="h-6 w-6 transition-transform duration-500 group-hover:scale-110" />
                    </span>
                    <span className="tnum font-heading text-4xl font-bold leading-none text-ink/[0.07]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="relative font-heading text-xl font-semibold tracking-tight text-ink">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="relative mt-3 flex-1 text-[15px] leading-relaxed text-ink-muted">
                      {service.description}
                    </p>
                  )}
                  {business.whatsapp && (
                    <a
                      href={waHref(
                        business.whatsapp,
                        `Hi ${business.name}, I'd like to know more about "${service.name}".`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="relative mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-brand opacity-0 transition-opacity duration-500 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      Enquire <ArrowUpRight className="h-4 w-4" />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            {services.items.map((service, i) => (
              <div
                key={service.name}
                className="reveal group grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1 border-b border-hairline py-7 transition-colors duration-500 first:border-t hover:border-brand/40"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="tnum eyebrow text-brand">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-heading text-2xl font-semibold tracking-tight text-ink transition-transform duration-500 group-hover:translate-x-1.5 sm:text-3xl">
                  {service.name}
                </h3>
                {service.description && (
                  <p className="col-start-2 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
                    {service.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}

// ── Why us ───────────────────────────────────────────────────────────

export function WhyUsSection({ content, dark: _dark }: { content: SiteContent; dark?: boolean }) {
  const { whyUs } = content;
  if (whyUs.items.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeading eyebrow="The difference">{whyUs.heading}</SectionHeading>
        <div className="grid gap-px overflow-hidden rounded-[2rem] border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {whyUs.items.map((item, i) => (
            <div
              key={item.title}
              className="reveal group relative bg-surface p-8 transition-colors duration-500 hover:bg-[color-mix(in_srgb,var(--site-primary)_5%,var(--site-surface))]"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span
                className="tnum flex h-12 w-12 items-center justify-center rounded-2xl font-heading text-lg font-bold text-brand-foreground shadow-[var(--shadow-lift)]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--site-primary), color-mix(in srgb, var(--site-primary) 55%, var(--site-accent)))",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-6 font-heading text-lg font-semibold tracking-tight text-ink">
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-muted">{item.description}</p>
              )}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

// ── Gallery (editorial mosaic) ───────────────────────────────────────

export function GallerySection({ content, dark: _dark }: { content: SiteContent; dark?: boolean }) {
  const { gallery, business } = content;
  const images = gallery.images.filter((image) => image.url).slice(0, 7);
  if (images.length === 0) return null;

  return (
    <Section id="gallery" tone="raised">
      <Container wide>
        <SectionHeading eyebrow="Gallery" sub="A look inside.">
          {gallery.heading}
        </SectionHeading>
        <GalleryGrid images={images} businessName={business.name} />
      </Container>
    </Section>
  );
}

// ── Reviews ──────────────────────────────────────────────────────────

export function ReviewsSection({ content, dark: _dark }: { content: SiteContent; dark?: boolean }) {
  const { business, reviews } = content;
  if (business.rating === null && reviews.snippets.length === 0) return null;

  return (
    <Section id="reviews" tone="sunken">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20">
          <div className="reveal lg:sticky lg:top-28">
            <Eyebrow>Google reviews</Eyebrow>
            <h2 className="display-sm mt-5 text-ink">{reviews.heading}</h2>
            {business.rating !== null && (
              <div className="mt-9 flex items-end gap-5">
                <p className="tnum font-heading text-7xl font-bold leading-[0.85] tracking-tight text-ink">
                  {business.rating.toFixed(1)}
                </p>
                <div className="pb-1.5">
                  <div className="flex gap-1" aria-label={`${business.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={clsx(
                          "h-5 w-5",
                          n <= Math.round(business.rating ?? 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-ink/15"
                        )}
                      />
                    ))}
                  </div>
                  {business.reviewCount !== null && (
                    <p className="mt-1.5 text-sm text-ink-muted">
                      based on <span className="tnum font-medium text-ink">{business.reviewCount}</span>{" "}
                      reviews
                    </p>
                  )}
                </div>
              </div>
            )}
            {business.mapUrl && (
              <a
                href={business.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
              >
                Read all reviews on Google <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>

          {reviews.snippets.length > 0 && (
            <div className="columns-1 gap-4 sm:columns-2">
              {reviews.snippets.map((snippet, i) => (
                <blockquote
                  key={snippet}
                  className="reveal edge mb-4 break-inside-avoid rounded-[1.5rem] border border-hairline bg-surface p-7 shadow-[var(--shadow-lift)]"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <Quote className="mb-4 h-6 w-6 fill-current text-brand/25" />
                  <p className="text-[15px] leading-relaxed text-ink">{snippet}</p>
                  <div className="mt-5 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </blockquote>
              ))}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}

// ── Testimonials ─────────────────────────────────────────────────────

export function TestimonialsSection({
  content,
  dark: _dark,
}: {
  content: SiteContent;
  dark?: boolean;
}) {
  const { testimonials } = content;
  if (testimonials.items.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeading eyebrow="Testimonials" sub="Sample testimonials shown for illustration.">
          {testimonials.heading}
        </SectionHeading>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.items.map((t, i) => (
            <figure
              key={t.name + t.text.slice(0, 12)}
              className="reveal edge lift flex flex-col rounded-[1.75rem] border border-hairline bg-surface p-8"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-5 flex-1 text-[15px] leading-relaxed text-ink">
                &ldquo;{t.text}&rdquo;
              </blockquote>
              <figcaption className="mt-7 flex items-center gap-3 border-t border-hairline pt-5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full font-heading text-xs font-bold text-brand-foreground"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--site-primary), color-mix(in srgb, var(--site-primary) 50%, var(--site-accent)))",
                  }}
                >
                  {initials(t.name)}
                </span>
                <span className="text-sm font-semibold text-ink">{t.name}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}

// ── FAQs ─────────────────────────────────────────────────────────────

export function FaqsSection({ content, dark: _dark }: { content: SiteContent; dark?: boolean }) {
  const { faqs, business } = content;
  if (faqs.items.length === 0) return null;

  return (
    <Section id="faqs" tone="raised">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="reveal lg:sticky lg:top-28">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="display-sm mt-5 text-ink">{faqs.heading}</h2>
            {business.whatsapp && (
              <p className="mt-6 text-[15px] leading-relaxed text-ink-muted">
                Can&rsquo;t find what you need?{" "}
                <a
                  href={waHref(business.whatsapp, `Hi ${business.name}, I have a question.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand hover:underline"
                >
                  Ask us on WhatsApp
                </a>
                .
              </p>
            )}
          </div>

          <div className="faq divide-y divide-hairline border-y border-hairline">
            {faqs.items.map((faq, i) => (
              <details key={faq.q} className="group reveal" style={{ animationDelay: `${i * 40}ms` }}>
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-6 font-heading text-lg font-semibold tracking-tight text-ink transition-colors duration-300 hover:text-brand">
                  {faq.q}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline transition-all duration-500 group-open:rotate-45 group-open:border-transparent group-open:bg-brand group-open:text-brand-foreground">
                    <Plus className="h-4 w-4" />
                  </span>
                </summary>
                <p className="max-w-2xl pb-7 text-[15px] leading-relaxed text-ink-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

// ── CTA band ─────────────────────────────────────────────────────────

export function CtaBand({ content }: { content: SiteContent }) {
  const { cta, business } = content;
  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <Container>
        <div className="brand-wash edge relative isolate overflow-hidden rounded-[2.5rem] px-8 py-20 text-center shadow-[var(--shadow-float)] sm:px-16">
          <span aria-hidden className="grain absolute inset-0" />
          <span
            aria-hidden
            className="absolute -bottom-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-white/25 blur-[80px]"
          />
          <div className="reveal relative">
            <h2 className="display-sm mx-auto max-w-3xl text-white">{cta.heading}</h2>
            {cta.subheading && <p className="lede mx-auto mt-6 max-w-xl text-white/80">{cta.subheading}</p>}
            <div className="mt-11 flex flex-wrap items-center justify-center gap-3">
              {business.whatsapp && (
                <a
                  href={waHref(business.whatsapp, `Hi ${business.name}!`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 font-semibold text-zinc-900 shadow-[var(--shadow-float)] transition-transform duration-500 hover:-translate-y-1"
                >
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                  {cta.buttonText}
                </a>
              )}
              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="inline-flex items-center gap-2.5 rounded-full border border-white/35 px-8 py-4 font-semibold text-white backdrop-blur transition-colors duration-300 hover:bg-white/10"
                >
                  <Phone className="h-5 w-5" />
                  <span className="tnum">{business.phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ── Contact ──────────────────────────────────────────────────────────

export function ContactSection({ content, dark: _dark }: { content: SiteContent; dark?: boolean }) {
  const { contact, business } = content;

  const rows: { icon: LucideIcon; label: string; value: React.ReactNode }[] = [];
  if (business.phone)
    rows.push({
      icon: Phone,
      label: "Call us",
      value: (
        <a href={`tel:${business.phone}`} className="tnum transition-colors hover:text-brand">
          {business.phone}
        </a>
      ),
    });
  if (business.whatsapp)
    rows.push({
      icon: MessageCircle,
      label: "WhatsApp",
      value: (
        <a
          href={waHref(business.whatsapp, `Hi ${business.name}!`)}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-brand"
        >
          Start a chat
        </a>
      ),
    });
  if (business.email)
    rows.push({
      icon: Mail,
      label: "Email",
      value: (
        <a href={`mailto:${business.email}`} className="break-all transition-colors hover:text-brand">
          {business.email}
        </a>
      ),
    });
  if (business.address)
    rows.push({
      icon: MapPin,
      label: "Visit us",
      value: business.mapUrl ? (
        <a
          href={business.mapUrl}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-brand"
        >
          {business.address}
        </a>
      ) : (
        business.address
      ),
    });

  return (
    <Section id="contact">
      <Container>
        <SectionHeading eyebrow="Get in touch" sub={contact.note || undefined}>
          {contact.heading}
        </SectionHeading>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {rows.map((row) => (
              <div
                key={row.label}
                className="edge group flex items-center gap-4 rounded-[1.5rem] border border-hairline bg-surface p-6 transition-colors duration-500 hover:border-brand/35"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-brand transition-transform duration-500 group-hover:scale-105"
                  style={{ background: "color-mix(in srgb, var(--site-primary) 11%, transparent)" }}
                >
                  <row.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="eyebrow text-ink-muted">{row.label}</p>
                  <p className="mt-1 font-medium text-ink">{row.value}</p>
                </div>
              </div>
            ))}
            {business.openingHours.length > 0 && (
              <div className="edge rounded-[1.5rem] border border-hairline bg-surface p-6 sm:col-span-2 lg:col-span-1">
                <p className="eyebrow flex items-center gap-2 text-ink-muted">
                  <Clock className="h-3.5 w-3.5" /> Opening hours
                </p>
                <div className="mt-3 space-y-1.5">
                  {business.openingHours.map((slot) => (
                    <p key={slot.days} className="flex justify-between gap-4 text-sm">
                      <span className="text-ink-muted">{slot.days}</span>
                      <span className="tnum font-medium text-ink">{slot.hours}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="reveal edge min-h-[26rem] overflow-hidden rounded-[1.75rem] border border-hairline shadow-[var(--shadow-lift)]">
            {business.mapEmbedUrl ? (
              <iframe
                src={business.mapEmbedUrl}
                title={`Map to ${business.name}`}
                className="h-full min-h-[26rem] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="brand-wash relative flex h-full min-h-[26rem] w-full items-center justify-center p-10 text-center">
                <span aria-hidden className="grain absolute inset-0" />
                <span className="relative">
                  <MapPin className="mx-auto h-8 w-8 text-white/80" />
                  <p className="display-sm mt-4 text-white">
                    {[business.area, business.city].filter(Boolean).join(", ") || "Visit us"}
                  </p>
                  {business.address && <p className="mt-2 text-white/75">{business.address}</p>}
                </span>
              </div>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────

export function SiteFooter({ content, dark: _dark }: { content: SiteContent; dark?: boolean }) {
  const { business, footer, services } = content;
  const nav = navFor(content);
  const year = new Date().getFullYear();
  const socials = [
    { icon: Instagram, href: business.socials.instagram, label: "Instagram" },
    { icon: Facebook, href: business.socials.facebook, label: "Facebook" },
    { icon: Linkedin, href: business.socials.linkedin, label: "LinkedIn" },
  ].filter((s) => s.href);

  return (
    <footer className="relative overflow-hidden border-t border-hairline bg-surface pt-20">
      <Container>
        <div className="grid gap-12 pb-16 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl font-heading text-sm font-bold text-brand-foreground"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--site-primary), color-mix(in srgb, var(--site-primary) 55%, var(--site-accent)))",
                }}
              >
                {initials(business.name)}
              </span>
              <span className="font-heading text-xl font-semibold tracking-tight text-ink">
                {business.name}
              </span>
            </div>
            {footer.tagline && (
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink-muted">{footer.tagline}</p>
            )}
            {socials.length > 0 && (
              <div className="mt-7 flex gap-2.5">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href.startsWith("http") ? s.href : `https://${s.href}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-ink-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-transparent hover:bg-brand hover:text-brand-foreground"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="eyebrow text-ink-muted">Explore</p>
            <ul className="mt-5 space-y-3">
              {nav.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-[15px] text-ink-muted transition-colors hover:text-brand">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow text-ink-muted">Services</p>
            <ul className="mt-5 space-y-3">
              {services.items.slice(0, 5).map((s) => (
                <li key={s.name} className="text-[15px] text-ink-muted">
                  {s.name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Oversized wordmark */}
        <div className="relative -mb-4 select-none overflow-hidden" aria-hidden>
          <p className="whitespace-nowrap text-center font-heading text-[clamp(3rem,13vw,11rem)] font-bold leading-[0.8] tracking-tighter text-ink/[0.05]">
            {business.name}
          </p>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline py-7 text-sm text-ink-muted sm:flex-row">
          <p>
            © {year} {business.name}. All rights reserved.
          </p>
          <p className="flex items-center gap-2">
            {[business.area, business.city].filter(Boolean).join(", ")}
            {business.phone && (
              <>
                <span className="opacity-30">·</span>
                <a href={`tel:${business.phone}`} className="tnum transition-colors hover:text-brand">
                  {business.phone}
                </a>
              </>
            )}
          </p>
        </div>
      </Container>
    </footer>
  );
}

export { ChevronDown, CheckCircle2 };
