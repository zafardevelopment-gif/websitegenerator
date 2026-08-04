# CLAUDE CODE MASTER PROMPT — INSTANT BUSINESS WEBSITE AI (v2.0)

## Internal tool for AIVEXA LLP — Phase-wise development plan

---

# ROLE

You are an elite product team consisting of:

- Principal Software Architect
- Senior Full Stack Next.js Engineer
- AI Engineer
- UI/UX Designer
- DevOps Engineer
- PostgreSQL Database Architect
- Product Designer
- Technical SEO Expert
- Growth Engineer (conversion tracking, outreach automation)

Your mission: build a commercial-grade internal application called **Instant Business Website AI**.

This is NOT a SaaS (yet). It is used only by AIVEXA LLP internally. Design it so it can become a multi-tenant SaaS later without major refactoring.

Purpose: generate premium demo websites for local businesses within minutes, deploy them instantly on a subdomain, send them via WhatsApp, track owner interest, and convert interested owners into paying clients with their own domain.

Think like you are building the internal software of the world's best digital marketing agency.

## Non-negotiable rules

- Never write placeholder code. Never skip implementation.
- Explain architectural decisions BEFORE coding.
- Build module by module, phase by phase. Complete each phase fully before moving on.
- At the end of every phase: give me a manual test checklist + `git commit` message.
- Ask me for any required API keys/credentials at the START of the phase that needs them, then proceed.
- Every UI screen must be responsive, dark/light mode, keyboard accessible.
- All user input validated with Zod on server side.
- TypeScript strict mode. No `any`.

---

# TECH STACK

- Next.js 15 App Router, React 19, TypeScript (strict)
- TailwindCSS + Shadcn UI + Framer Motion + Lucide Icons
- Supabase (PostgreSQL, Auth, Storage, RLS, Edge Functions where useful)
- Server Actions for mutations, Route Handlers for webhooks/APIs
- Claude API (primary content engine), Gemini API (fallback), OpenAI-compatible abstraction layer
- Cloudinary (image optimization) — fallback: Supabase Storage + next/image
- Vercel (hosting, cron jobs, wildcard domains)
- Zod, React Hook Form, TanStack Table, Recharts
- Resend (transactional email) or SMTP
- Razorpay (payment links for won deals)
- QRCode generation library
- @react-pdf/renderer or Puppeteer for PDF proposals

---

# CRITICAL ARCHITECTURE DECISION — READ FIRST

## Multi-tenant renderer, NOT per-demo deployments

Do NOT create a separate Vercel project/deployment per demo website. That is slow, costly, and unmanageable at 100+ demos.

Instead:

1. ONE Next.js app (`sites-renderer`) is deployed once on Vercel with wildcard domain `*.aivexallp.com`.
2. Middleware reads the subdomain (e.g. `smiledental.aivexallp.com`), looks up the site record in Supabase, and renders the correct template with that business's content — using ISR/dynamic rendering with caching.
3. "Deploying" a demo = inserting/activating one database row + cache revalidation. Live in seconds. Deleting = soft-delete row. Zero infra cost per site.
4. Custom client domains later: Vercel Domains API adds the domain to the same project, middleware maps domain → site record.
5. The admin dashboard (`admin.aivexallp.com` or `app.aivexallp.com`) is a SEPARATE Next.js app (or same monorepo, separate app) protected by Supabase Auth.

Use a monorepo (turborepo or npm workspaces):

```
/apps
  /admin        → internal dashboard
  /sites        → multi-tenant website renderer
/packages
  /ui           → shared design system components
  /templates    → website template components
  /db           → Supabase client, types, queries
  /ai           → AI provider abstraction + prompt templates
  /config       → shared config, constants
```

Explain trade-offs of this approach to me in Phase 0 before scaffolding.

---

# CORE MODULES (FULL FEATURE LIST)

## 1. Dashboard
- KPI cards: total leads, demos live, WhatsApp sent, demo views this week, interested, won, revenue pipeline
- "Hot leads" widget: leads whose demo was VIEWED in last 48h (sorted by view count)
- Pending follow-ups today
- Recent activity feed
- AI cost this month (tokens + ₹ estimate)
- Global search (Cmd+K) across leads, sites, deployments

## 2. Lead CRM
Fields: Business Name, Category, Owner Name, Phone, WhatsApp, Email, Website, Instagram, Facebook, LinkedIn, Google Rating, Review Count, Address, Area, City, State, Country, PIN, Latitude, Longitude, Google Maps URL, Place ID, Business Description, Services (array), Opening Hours, Notes, Lead Source, Tags (array), Priority (High/Medium/Low), Lead Score (0–100), Created, Last Contacted, Next Follow-up, Status.

Statuses: New → Website Generated → Demo Deployed → WhatsApp Sent → Demo Viewed → Waiting → Interested → Meeting → Quotation Sent → Negotiation → Won / Lost / Deleted.

Features:
- **Bulk import from CSV/JSON** with column mapping UI, preview, validation report, duplicate detection (by phone/place_id), and import history. (I already have lead files with 40+ columns — importer must handle extra columns gracefully.)
- Table view (TanStack: sort, filter, column visibility, saved views) + **Kanban pipeline view** (drag-drop status) + **Map view** (all leads plotted, colored by status)
- Lead detail page with full **activity timeline** (every status change, message sent, demo view, note — auto-logged)
- Duplicate merge tool
- Auto lead scoring: rating × reviews × has-no-website × category weight (editable formula in settings)
- Quick actions on every row: Generate Website / Send WhatsApp / Add Follow-up / Change Status
- Tags with color coding; saved filters ("Karol Bagh dentists", "High priority no-website")
- Soft delete + restore

## 3. Website Generator
- Select lead → select template → AI generates all content → preview → edit → deploy. Target: under 3 minutes end to end.
- **Section-by-section inline editor**: every AI-generated section (hero, about, services, FAQs…) shows an Edit button and a "Regenerate with AI" button (with optional instruction like "make it more premium").
- **Live device preview**: iframe preview with mobile / tablet / desktop toggle before deploying.
- **Bilingual option**: generate English-only, Hindi-only, or bilingual (EN primary + Hindi toggle on site).
- Version history: every regeneration saved; rollback any section.
- Clone website: duplicate an existing generated site to a new lead, replacing only business identity (name, logo, colors, services, phone, address, socials, images).

## 4. Template Library
Premium templates per category. Categories: Dental Clinic, Medical Clinic, Hospital, Pharmacy, Diagnostic Center, Gym, Fitness Studio, Yoga Center, Restaurant, Cafe, Bakery, Salon, Spa, Barber Shop, Lawyer, CA, Architect, Interior Designer, Construction, Furniture, Travel Agency, Hotel, Resort, Real Estate, Car Dealer, Car Service Center, Photography, School, College, Coaching Institute, NGO, Manufacturer, Wholesaler, Retail Store, Electronics, Fashion, Jewellery, General Business.

Rules:
- Templates are structured React components fed by a typed `SiteContent` JSON schema — NOT random AI layouts. Design system stays consistent.
- Each template supports 3–4 **color scheme variants** and 2 **layout variants** (so 50 dentists don't get identical demos).
- Template preview gallery with live demo of each.
- Start with 5 flagship templates (Dental, Restaurant, Salon, Gym, General Business); architecture must make adding a template a 1-file exercise.

## 5. Website Features (every generated site)
Sticky header, animated hero, About, Services, Gallery, Testimonials, FAQs, Google Reviews section (rating + count + top review snippets from lead data), Contact form, Appointment/booking form (submissions stored in DB + notify me), Click-to-call button, Floating WhatsApp button, Google Map embed, Instagram/Facebook links, Opening Hours, Footer, Privacy Policy, Terms, 404 page.

SEO/Tech: SSR/ISR, meta tags, Open Graph, Twitter Cards, **auto-generated OG image** (business name + tagline on branded card), Schema.org LocalBusiness JSON-LD (with geo, hours, rating), robots.txt, sitemap.xml per site, lazy loading, next/image, accessibility (WCAG AA), Core Web Vitals optimized.

**Demo mode extras**:
- Subtle top banner: "Demo website prepared by AIVEXA — [WhatsApp us]" (removable on conversion)
- `noindex` while in demo mode (flip on conversion)
- **Demo expiry**: after N days (default 14, configurable) banner shows "This demo expires in X days"; after expiry site auto-archives (cron)

## 6. AI Content Engine
- Provider abstraction: Claude (primary) → Gemini (fallback) → OpenAI-compatible (optional). Automatic failover + retry with backoff.
- Generates: headline, hero title/subtitle, about, services (with descriptions + icons), features, why choose us, FAQs, testimonials (clearly generic/sample — never fake real named people), CTAs, SEO title/description/keywords, image alt text, footer text, meta description, business description, WhatsApp pitch, email pitch.
- **Structured output**: AI must return validated JSON matching `SiteContent` Zod schema; auto-repair loop on invalid JSON (max 2 retries).
- **Prompt Template Manager** in Settings: system prompts per category stored in DB, editable in UI, versioned — so I can tune output without redeploying.
- **AI usage & cost tracking**: log every call (provider, model, tokens in/out, latency, cost estimate, purpose, lead_id). Dashboard chart + monthly budget alert.
- Tone presets: Premium / Friendly / Medical-professional / Luxury.

## 7. Branding Engine
Auto-generate per site: primary/secondary/accent colors (category-aware palettes, WCAG-checked contrast), typography pairing (from curated Google Fonts list), icon style, button style, card style. Manual override on all. **Logo fallback**: if no logo uploaded, generate a clean text-based logo (initials in a styled badge).

## 8. Media Library
Upload: logo, hero, gallery, team, certificates, videos. Cloudinary transform pipeline (compress, WebP/AVIF, responsive sizes). **Stock image auto-fill**: category-mapped curated stock image sets (bundled/licensed) so a demo NEVER ships with empty images. Per-lead media folders. Drag-drop, paste-from-clipboard upload. Usage: show which sites use an asset.

## 9. Deployment Manager
- One-click deploy → subdomain slug auto-suggested from business name (editable, uniqueness check, reserved-word blocklist).
- Store: URL, date, status (draft/live/expired/archived/converted), logs, SSL status (wildcard cert = automatic).
- **QR code** auto-generated for every live demo (download PNG — useful for in-person visits).
- Redeploy/refresh content, pause site, delete (soft delete + purge job). Keep audit logs.

## 10. Demo Engagement Tracking ⭐ (highest-value new module)
- First-party, cookieless, lightweight tracking script in every demo site.
- Track: page views, unique visits, device type, time on page, section scroll depth, clicks on Call / WhatsApp / Appointment buttons.
- Lead timeline auto-logs "Demo viewed" events; lead status can auto-advance WhatsApp Sent → Demo Viewed.
- **Notify me** (in-app + optional email/WhatsApp to my own number) when a demo gets its first view and when an owner clicks the WhatsApp/Call button on the demo.
- Per-site mini analytics panel; "Hot Leads" ranking on Dashboard.

## 11. Website Health Score & AI Audit
- After generation compute: SEO, Performance (Lighthouse via PageSpeed Insights API on live URL), Accessibility, Best Practices, Mobile & Desktop friendliness, Conversion score, Trust score, Speed, Visual quality, Overall score.
- AI Audit report: strengths, weaknesses, missing features, SEO / conversion / trust / speed / accessibility improvements.
- Client-facing version of the audit exportable as branded PDF (great for pitching against their existing weak website too).

## 12. Outreach Suite
- **WhatsApp Proposal Generator**: one click → AI-personalized Hinglish/English message including demo URL + 1–2 specific compliments from their real Google reviews data. Copy button + `wa.me` deep link. Message templates manager (variables: {owner}, {business}, {rating}, {reviews}, {demo_url}, {area}).
- **Optional WhatsApp Business Cloud API integration** (Phase 11): send directly from app, log delivery/read status to lead timeline. Manual wa.me mode always available as default.
- **Email Generator**: subject, opening, body, CTA, signature; send via Resend/SMTP; open-tracking pixel logs to timeline.
- **PDF Proposal Generator**: cover page, current online presence summary, problems found, demo screenshots, features, benefits, pricing table (editable), agency info. Branded, auto-generated, attach to email/WhatsApp.
- Follow-up message sequences: predefined day-2 / day-5 / day-10 nudge templates, one-click send with context.

## 13. Follow-up Manager
Pending follow-ups dashboard, calendar view, per-lead timeline, snooze/reschedule, overdue highlighting. **Vercel Cron** daily job: compile due follow-ups + hot-lead digest and notify me (in-app + email/WhatsApp). Auto-suggest next follow-up date on every status change.

## 14. Analytics
Funnel: Leads → Generated → Deployed → Sent → Viewed → Interested → Meeting → Quotation → Won/Lost, with stage-to-stage conversion %. Filters by date range, category, area, source, tag. Charts (Recharts): weekly activity, category performance, area heat, win rate trend, AI cost vs revenue won. Export any report to CSV.

## 15. Client Conversion & Domain Manager
Won flow: Convert Demo → Permanent Project → collect requirements checklist → connect custom domain (Vercel Domains API: add domain, show DNS instructions, verify, auto-SSL) → remove demo banner + enable indexing → production website.
- **Quotation module**: line items, GST toggle, totals; generate PDF quotation; statuses (sent/accepted/rejected).
- **Razorpay payment links** for advance/full payment attached to quotation; webhook updates payment status on lead.
- Client record: domain expiry, renewal date, maintenance notes, hosting notes; renewal reminders via cron.

## 16. Settings
Agency profile (name, logo, WhatsApp, email, address, GST no.), SMTP/Resend, AI providers + keys + model selection + monthly budget, Cloudinary, deployment config (base domain, demo expiry days), default branding, prompt templates, message templates, scoring formula weights, notification preferences, team members (owner/admin/viewer roles — future-ready), backup/export (full JSON export of all data).

---

# DATABASE

Design a scalable PostgreSQL schema in Supabase:
- Core tables: users, leads, lead_activities, lead_imports, templates, sites, site_versions, site_sections, deployments, media_assets, site_visits, site_events, form_submissions, messages (whatsapp/email log), follow_ups, quotations, quotation_items, payments, clients, domains, ai_usage_logs, prompt_templates, message_templates, audit_logs, settings.
- Proper FKs, indexes (esp. leads.status, leads.next_follow_up, sites.slug unique, site_visits.site_id+created_at), enums via Postgres types, `updated_at` triggers, soft delete columns, audit log triggers on critical tables.
- RLS on everything (single-tenant now: authenticated internal users; structure policies so adding `org_id` later enables multi-tenant).
- Generate as versioned SQL migration files. Seed script with sample data.

# SECURITY
Supabase Auth (email + OTP), role-based authorization, RLS, Zod server-side validation everywhere, rate limiting on public endpoints (form submissions, tracking), secure signed uploads, sanitize all AI output rendered as HTML, secrets only in env vars, tracking endpoint abuse protection, CSRF-safe server actions.

---

# PHASE-WISE DEVELOPMENT PLAN

Execute strictly in order. Do not start a phase until I say "start phase X" or "continue".

## PHASE 0 — Architecture & SRS
- Explain the multi-tenant renderer architecture, trade-offs, and monorepo layout.
- Produce full SRS: modules, user stories, acceptance criteria, data flow diagrams (mermaid), entity relationship diagram (mermaid).
- List every env var and external account I need (Supabase, Vercel, Cloudinary, Claude, Gemini, Resend, Razorpay) with setup steps including wildcard DNS `*.aivexallp.com` → Vercel.
- Deliverable: `docs/SRS.md`, `docs/ARCHITECTURE.md`.

## PHASE 1 — Foundation
- Monorepo scaffold (apps/admin, apps/sites, packages/*), TypeScript strict, ESLint, Prettier.
- Shadcn setup, design tokens (Linear/Stripe-grade: spacing scale, radius, typography, dark/light themes), base layout: sidebar nav, topbar, Cmd+K skeleton, toast system.
- Supabase project wiring, Auth (login page, protected routes, session handling).
- Settings module (agency profile + API keys storage, encrypted).
- Deliverable: running admin shell with auth + settings.

## PHASE 2 — Database & Data Layer
- Full schema migrations + RLS policies + triggers + seed data.
- `packages/db`: typed query layer (generated types), repository functions for every table.
- Audit logging infrastructure.
- Deliverable: migrations applied, seed loaded, typed client working.

## PHASE 3 — Lead CRM (part 1: core)
- Leads table view (TanStack), create/edit forms (RHF+Zod), detail page with activity timeline, statuses, tags, priority, notes, soft delete.
- Quick actions, saved filters, global search integration.

## PHASE 4 — Lead CRM (part 2: power features)
- Bulk CSV/JSON importer with mapping UI, dedupe, validation report, import history.
- Kanban pipeline view (drag-drop), Map view (leads plotted), duplicate merge, lead scoring engine (configurable weights in settings).
- Deliverable: I can import my existing 50-lead CSV and manage the pipeline visually.

## PHASE 5 — Template Engine & Library
- `SiteContent` Zod schema (the single contract between AI, editor, and renderer).
- Build `packages/templates` architecture + 5 flagship templates (Dental, Restaurant, Salon, Gym, General) with color/layout variants.
- Template gallery in admin with live previews.
- Sites renderer app (`apps/sites`) with subdomain middleware rendering seeded demo content.

## PHASE 6 — AI Content Engine
- Provider abstraction (Claude → Gemini failover), structured JSON generation with schema validation + repair loop.
- Prompt Template Manager (DB-stored, editable, versioned) with strong default prompts per category and tone presets.
- Bilingual generation support.
- AI usage logging + cost dashboard widget.

## PHASE 7 — Website Generator & Editor
- Full flow: lead → template + variant → AI generate → section-by-section editor (edit/regenerate per section) → branding panel (colors/fonts override) → media assignment → device preview → save version.
- Version history + rollback. Clone-to-another-lead flow.

## PHASE 8 — Media Library
- Cloudinary pipeline, upload UX (drag-drop/paste), per-lead folders, stock image auto-fill by category, optimization, usage tracking.

## PHASE 9 — Deployment Engine
- Slug management, one-click publish (DB activation + revalidation), demo banner + noindex, expiry system with Vercel Cron auto-archive, QR code per site, deployment logs/status, pause/delete with audit trail.
- SEO plumbing on renderer: meta/OG/Twitter/schema/sitemap/robots/OG-image generation.
- Deliverable: end-to-end — pick a real lead, generate, deploy to `slug.aivexallp.com`, scan QR on my phone.

## PHASE 10 — Demo Engagement Tracking
- Lightweight tracking script in renderer, ingestion endpoint (rate-limited), site_visits/site_events tables, per-site analytics panel, lead timeline integration, auto status advance, hot-leads dashboard widget, first-view + CTA-click notifications.

## PHASE 11 — Outreach Suite
- WhatsApp message generator (templates + AI personalization + wa.me), message log on timeline.
- Email generator + Resend sending + open tracking.
- PDF proposal generator with demo screenshots (server-side capture) and editable pricing.
- Follow-up sequences (day-2/5/10 templates).
- Optional: WhatsApp Business Cloud API integration behind a settings toggle.

## PHASE 12 — Follow-up Manager & Automation
- Follow-ups dashboard + calendar, snooze/reschedule, auto-suggestions on status change.
- Vercel Cron: daily digest (due follow-ups + hot leads + expiring demos) via in-app + email/WhatsApp-to-self.

## PHASE 13 — Analytics & Health Scores
- Funnel analytics with filters + charts + CSV export.
- Health Score engine (incl. PageSpeed Insights API) + AI Audit + client-facing branded audit PDF.

## PHASE 14 — Conversion, Domains & Payments
- Convert-demo flow, quotation module + PDF, Razorpay payment links + webhook, Vercel Domains API custom-domain connect with DNS verify UI, client records + renewal reminders.

## PHASE 15 — Hardening & Launch
- Security pass (checklist above), rate limiting, error boundaries, Sentry (optional), empty/loading/error states audit, Lighthouse ≥95 on admin & templates, E2E happy-path tests (Playwright) for: import → generate → deploy → track → convert. Backup/export. Final docs: `docs/RUNBOOK.md`, `docs/ADDING_TEMPLATES.md`.

---

# DEFINITION OF DONE (every phase)
1. All code complete, typed, no TODOs.
2. Zod validation on all inputs.
3. Dark + light mode verified.
4. Mobile responsive verified.
5. Manual test checklist provided and passing.
6. Commit message provided.

# START
Begin with **Phase 0**. Do not write application code yet — deliver the architecture explanation and SRS first, then wait for my approval.
