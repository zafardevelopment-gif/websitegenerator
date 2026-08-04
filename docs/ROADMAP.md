# Roadmap — Lead → Demo → WhatsApp → Deal

Working plan for the outreach engine on top of the existing platform.
Phases run in order; each is independently shippable. **Status legend:**
`⬜ pending` · `🟨 in progress` · `✅ done`

**Business flow this serves**

```
lead import  →  AI generates demo site  →  site published on a demo slot
     →  WhatsApp pitch sent (n8n)  →  owner opens site (tracked)
     →  owner replies (n8n writes it back)  →  deal won / lost
     →  won: migrate to client's own domain, slot recycled
     →  lost/silent: slot auto-reclaimed after expiry
```

Everything is tracked **inside this admin app**. n8n is only a transport
layer: it sends WhatsApp messages out and posts replies back in. It never
holds state of its own.

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

## Phase 1 — Demo slot pool 🟨

**Problem.** Every generated site currently takes its own permanent slug
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
- [ ] **Remaining:** run `tsc`/`next build` on Windows and apply migration
      0011 to Supabase (sandbox here can't finish a full Next build)

**Done when:** publishing a demo consumes a slot, winning or losing a deal
returns it, and the pool view shows exactly which lead holds which slug.

---

## Phase 2 — Slot expiry & auto-reclaim ⬜

A 10-slot pool is exhausted in two weeks without automatic recycling.

- [ ] `demo_expires_at` drives a nightly sweep in the existing cron route
- [ ] Warn at T-3 days (in-app notification + follow-up task)
- [ ] At T-0: site → `expired`, slot → `cooldown`, then `free`
- [ ] Expired URL serves a branded holding page, not a 404
- [ ] "Extend 7 days" action for live conversations
- [ ] Never auto-expire a lead in `interested` / `meeting` / `negotiation`

**Done when:** the pool sustains itself with no manual cleanup.

---

## Phase 3 — Phone identity & reply attribution ⬜

WhatsApp replies arrive as a bare phone number. Without canonical numbers,
inbound messages can't be matched to a lead.

- [ ] Migration `0012_phone_identity.sql` — `phone_e164`, `whatsapp_e164`
      generated/maintained columns + unique partial indexes
- [ ] Backfill existing leads to E.164 (`+91…`)
- [ ] Normalize on every write path: import, manual create, Google Places
- [ ] `findLeadByPhone(e164)` resolver with a documented ambiguity rule
- [ ] Inbound direction on messages: `direction` enum (`outbound|inbound`),
      `replied_at` on the lead

**Done when:** any Indian phone format resolves to exactly one lead.

---

## Phase 4 — Inbound webhook for n8n ⬜

The single API surface n8n writes back to.

- [ ] `POST /api/webhooks/whatsapp-inbound` — HMAC-signed, replay-protected
- [ ] Resolves lead by `phone_e164`, stores an inbound message, appends a
      lead activity, fires a notification
- [ ] Auto-advances status `whatsapp_sent → interested` on first reply
      (configurable, never downgrades a later stage)
- [ ] Delivery-status callback (`sent / delivered / read / failed`)
- [ ] Idempotent on provider message id
- [ ] Shared secret in settings, rotatable from the UI

**Done when:** a POST from n8n shows up on the lead timeline within seconds.

---

## Phase 5 — Engagement signals on the lead timeline ⬜

The strongest closing signal is "they opened the site". Tracking already
exists (`/api/track`) but never surfaces where decisions get made.

- [ ] Lead detail: opened / not opened, first + last view, view count,
      time on page, which sections were read, CTA clicks
- [ ] `demo_viewed` status auto-set on first real view (bots filtered)
- [ ] Leads list: "viewed but silent" filter — the highest-intent segment
- [ ] Feed engagement into the existing health score

**Done when:** you can sort the pipeline by who actually looked.

---

## Phase 6 — n8n workflow ⬜

Only now, once the app owns all the state.

- [ ] Exportable workflow JSON committed to `integrations/n8n/`
- [ ] Outbound: poll/receive queued pitches → send WhatsApp → report status
- [ ] Inbound: receive replies → POST to the Phase 4 webhook
- [ ] Follow-up ladder: no reply in 3 days → nudge; no reply in 7 → final
- [ ] Quiet hours + per-day send cap
- [ ] Setup guide covering the WhatsApp Cloud API template-message
      requirement for cold outreach (see risk note below)

**Done when:** a lead moves from `website_generated` to a captured reply
without anyone touching a keyboard.

---

## Phase 7 — Won-deal migration ⬜

- [ ] Guided flow: attach client domain → Vercel domain add → DNS
      instructions → verify → flip site to `production`
- [ ] 301 from the demo slot to the client domain during a grace window
- [ ] Release the slot back to the pool when the grace window ends
- [ ] Client handover pack (credentials, what they own, what renews)

**Done when:** winning a deal is a single guided flow, not a checklist.

---

## Open risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Cold WhatsApp outreach outside the 24-hour window requires an **approved template message** on the Cloud API | Number ban, pipeline dead | Decide official Cloud API vs. manual send **before** Phase 6; keep manual send as fallback |
| Two leads sharing one phone number | Reply lands on the wrong lead | Ambiguity rule in Phase 3 — never auto-attach, flag for review |
| Demo slot reused while the old URL is still circulating | Wrong business shown to a prospect | `cooldown` state (Phase 1) + expired holding page (Phase 2) |
| Generated content misstates a real business's facts | Trust damage on first contact | Testimonials already labelled as samples; keep facts sourced from Google Places only |

---

_Last updated: 2026-08-04_
