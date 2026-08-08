# Roadmap — Lead → Demo → WhatsApp → Deal

Working plan for the outreach engine on top of the existing platform.
Phases run in order; each is independently shippable. **Status legend:**
`⬜ pending` · `🟨 in progress` · `✅ done`

**Business flow (as-built)**

```
lead import  →  AI generates demo site
     →  WhatsApp pitch auto-sent via Meta Cloud API (demo_pitch_intro template)
     →  delivery status tracked (sent → delivered → read)
     →  owner replies → lead auto-advances to "interested"
     →  reply_team_followup template auto-sent
     →  deal won: migrate to client domain, slot recycled
     →  deal lost / silent: slot auto-reclaimed after expiry
```

n8n is optional — the Meta Cloud API webhook (`/api/webhooks/whatsapp-meta`)
handles inbound messages natively. n8n can still be used as an alternate
transport via `/api/webhooks/whatsapp-inbound` (HMAC-signed).

---

## To activate (pending Supabase + settings)

Apply these migrations **in order** to your Supabase project:

```
supabase/migrations/0011_demo_slots.sql
supabase/migrations/0012_slot_expiry_notifications.sql
supabase/migrations/0013_phone_identity.sql
supabase/migrations/0014_whatsapp_inbound.sql
supabase/migrations/0015_domain_handoff.sql
```

Then in **Settings → API Keys → Meta WhatsApp Cloud API**:

| Field | Where to find it |
| --- | --- |
| Phone Number ID | Meta for Developers → your app → WhatsApp → API Setup |
| Permanent access token | Same page — generate a permanent token |
| Webhook verify token | Choose any string; you'll paste the same one in Meta |
| Call-back number | Your mobile number shown in outgoing messages |

Finally in **Meta for Developers → WhatsApp → Configuration → Webhook**:
- Callback URL: `https://<your-admin-domain>/api/webhooks/whatsapp-meta`
- Verify token: the same string you saved above
- Subscribe to: `messages`

After that: generate a site → WhatsApp pitch fires automatically.

---

## Phase 0 — Premium design system ✅

Generated sites looked generic; that killed the pitch before it started.

- [x] Premium CSS layer in `apps/sites/app/globals.css` — aurora mesh
      gradients, grain, glass, gradient hairline edges, scroll-linked
      reveal animations, marquee, elevation scale
- [x] `packages/templates/src/components/sections.tsx` rewritten — floating
      glass header + JS-free mobile nav, 3 hero variants (cinematic / split /
      centered), trust marquee, stats band, premium service cards + editorial
      menu list, bento about, sticky-split reviews, mosaic gallery, accordion
      FAQ, glowing CTA, oversized-wordmark footer, expanding WhatsApp dock
- [x] Richer palettes, per-variant radius language, premium font pairings
      (`registry.tsx`, `branding.ts`)
- [x] All 5 templates re-composed onto the new sections
- [x] Content-derived nav (no dead `#gallery` / `#faqs` anchors)
- [x] Verified: `tsc` clean, SSR render of all 5 templates, Tailwind emits
      every utility used

**Zero client JS** — templates stay pure Server Components. Motion uses CSS
scroll-driven animations and degrades gracefully.

---

## Phase 1 — Demo slot pool ✅

**Problem.** Every generated site takes its own permanent slug
(`smile-dental.aivexallp.com`). Slugs are never released, so hosting grows
without bound and a won deal leaves a dead subdomain behind.

**Solution.** A fixed pool of reusable slots — `demo1 … demo10` — leased to
a site for the length of a pitch, then returned.

- [x] Migration `0011_demo_slots.sql` — table, `aiwebsite_slot_status` enum,
      RLS, seed `demo1…demo10`, and four SECURITY DEFINER functions:
      `claim` (`for update skip locked`, idempotent per site), `release`,
      `release_for_site`, `sweep`
- [x] `packages/db/src/repositories/demo-slots.ts` — claim / release /
      sweep / counts / grow, `NoFreeSlotError` for the exhausted-pool case
- [x] DB types: `DemoSlotRow`, `SlotStatus`, RPC signatures
- [x] Publish flow leases a slot instead of minting a slug; production-mode
      sites keep their own slug
- [x] Release on archive, delete, and `lost`; **not** on `won` — that waits
      for the Phase 7 domain hand-off
- [x] Released slug is retired on the site row (`demo3-x7f2a1`) so the next
      lease can't collide on `aiwebsite_sites.slug`
- [x] `cooldown` state + `extendDemoExpiryAction` (mirrors expiry onto the slot)
- [x] Slug rename blocked while a demo holds a pooled subdomain
- [x] Admin UI `/settings/slots` — occupancy stats, holder + days left,
      manual release, disable/enable, grow pool, manual sweep
- [x] Build passes — ESLint fix in `media-manager.tsx` applied

**Done when:** publishing a demo consumes a slot, winning or losing a deal
returns it, and the pool view shows exactly which lead holds which slug.

**Remaining:** apply migration `0011` to Supabase (code is fully deployed).

---

## Phase 2 — Slot expiry & auto-reclaim ✅

A 10-slot pool is exhausted in two weeks without automatic recycling.

- [x] `demo_expires_at` drives a nightly sweep in the existing cron route
      (`/api/cron/expire-demos`)
- [x] Warn at T-3 days (in-app notification `demo_expiring_soon` + a
      follow-up task, deduped per expiry via migration `0012`)
- [x] At T-0: site → `expired`, slot → `cooldown` (via `releaseSlotForSite`),
      then the same cron sweeps `cooldown` → `free`
- [x] Expired URL serves a branded holding page, not a 404
- [x] "Extend 7 days" action for live conversations (`extendDemoExpiryAction`)
- [x] Never auto-expire a lead in `interested` / `meeting` / `negotiation` —
      cron joins lead status and postpones instead of expiring

**Done when:** the pool sustains itself with no manual cleanup.

---

## Phase 3 — Phone identity & reply attribution ✅

WhatsApp replies arrive as a bare phone number. Without canonical numbers,
inbound messages can't be matched to a lead.

- [x] Migration `0013_phone_identity.sql` — `phone_e164`, `whatsapp_e164`
      trigger-maintained columns + partial indexes. Not unique — two leads
      can share a number; ambiguity rule handles this instead of a DB constraint
- [x] Backfill existing leads to E.164 (`+91…`) — one-time `UPDATE` in the
      migration runs automatically
- [x] Normalize on every write path — the trigger fires on any
      insert/update to `phone`/`whatsapp`, so import, manual create, and
      Google Places all normalize automatically with zero app-code changes
- [x] `findLeadByPhone(e164)` resolver — checks both `phone_e164` and
      `whatsapp_e164`; returns `ambiguous: true` instead of guessing when
      more than one active lead matches
- [x] `direction` enum (`outbound|inbound`) on messages; `replied_at` on lead

**Done when:** any Indian phone format resolves to exactly one lead.

---

## Phase 4 — Inbound webhook ✅

The single API surface for receiving WhatsApp replies.

- [x] `POST /api/webhooks/whatsapp-inbound` — HMAC-SHA256 signed
      (`X-Webhook-Signature`), replay-protected via `provider_message_id`
- [x] `GET /POST /api/webhooks/whatsapp-meta` — native Meta Cloud API webhook
      (no n8n hop); handles both inbound messages and delivery-status callbacks
      natively; `GET` handles Meta's verify-token handshake
- [x] Resolves lead by `phone_e164` / `whatsapp_e164` via `findLeadByPhone`,
      stores inbound message, appends `message_received` activity, fires
      `inbound_reply` notification
- [x] Auto-advances status `whatsapp_sent` / `demo_viewed` / `waiting` →
      `interested` on first reply; never downgrades a later pipeline stage
- [x] Delivery-status callback (`sent → delivered → read(opened) → failed`),
      rank-gated so a retried "sent" cannot undo a "read"
- [x] Idempotent on `provider_message_id`
- [x] `reply_team_followup` template auto-sent on first reply if Cloud API
      is configured
- [x] Ambiguous / unmatched numbers flagged via `inbound_reply_ambiguous`
      notification, never auto-attached

**Done when:** a reply from the business owner shows up on the lead timeline
within seconds of them hitting send.

---

## Phase 5 — Engagement signals on the lead timeline ✅

The strongest closing signal is "they opened the site".

- [x] Lead detail: opened / not opened, first + last view, view count,
      time on page, which sections were read, CTA clicks
- [x] `demo_viewed` status auto-set on first real view (bots filtered)
- [x] Leads list: "viewed but silent" quick filter — highest-intent segment
- [x] Engagement feeds into the existing health score

**Done when:** you can sort the pipeline by who actually looked.

---

## Phase 6 — WhatsApp Cloud API auto-send ✅

Approved templates: `demo_pitch_intro` (Marketing) + `reply_team_followup` (Utility).

- [x] `lib/server/whatsapp-cloud.ts` — Meta Cloud API sender
      (`sendWhatsAppTemplate`, `sendWhatsAppFreeform`); `WhatsAppCloudError`
      with provider error forwarding
- [x] `lib/whatsapp-pitch.ts` — sector-specific pitch text shared by manual
      dialog and auto-send (`buildDemoPitchText`, `buildDemoPitchTemplateParams`,
      `buildReplyFollowupTemplateParams`); 5 sector regexes, `useDrGreeting`
      for dental leads
- [x] Auto-send on generate — `autoSendDemoPitch()` in `generator.ts` fires
      `demo_pitch_intro` right after site generation; no-ops if Cloud API
      isn't configured (manual send remains available)
- [x] `toWaId()` normalizes any format to WhatsApp's digit-only id
      (10-digit local → `91XXXXXXXXXX`)
- [x] Settings UI — Settings → API Keys → "Meta WhatsApp Cloud API" group
      (Phone Number ID, permanent access token, verify token, callback number)
- [x] Dashboard WhatsApp card: sent / delivered / read / failed + reply rate
      + live feed of recent inbound messages (`getWhatsAppStats`,
      `listRecentWhatsAppReplies`)
- [x] Both templates `demo_pitch_intro` and `reply_team_followup` approved
      on Meta Business Manager (2026-08-08)

**Done when:** generate a site → pitch fires → reply lands on lead timeline.

---

## Phase 7 — Won-deal migration ✅

- [x] Guided flow: attach client domain → Vercel domain add → DNS
      instructions → verify → flip site to `production`
- [x] 301 from the demo slot to the client domain during a 14-day grace window
- [x] Release the slot back to the pool when the grace window ends
- [x] Client handover pack PDF (live URL, domain/renewal dates, ownership
      breakdown, support contact) — `generateHandoverPackAction`

Migration `0015_domain_handoff.sql` adds the two columns this needed.

**Done when:** winning a deal is a single guided flow, not a checklist.

---

## Open risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Meta permanent access token expires | Auto-send silently fails | Use a System User token (never expires) from Meta Business Settings, not the temporary one from API Setup |
| Two leads sharing one phone number | Reply lands on wrong lead | `ambiguous: true` rule (Phase 3) — flags for review, never auto-attaches |
| Demo slot reused while old URL is circulating | Wrong business shown | `cooldown` state (Phase 1) + expired holding page (Phase 2) |
| Generated content misstates a real business's facts | Trust damage on first contact | Testimonials labelled as samples; facts sourced from Google Places only |
| WhatsApp session window (24h) for freeform replies | Can't reply freeform after 24h | Always use approved templates for business-initiated messages; freeform only within the window |

---

_Last updated: 2026-08-08_
