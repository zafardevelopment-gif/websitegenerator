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

## Phase 2 — Slot expiry & auto-reclaim ✅

A 10-slot pool is exhausted in two weeks without automatic recycling.

- [x] `demo_expires_at` drives a nightly sweep in the existing cron route
      (`/api/cron/expire-demos`)
- [x] Warn at T-3 days (in-app notification `demo_expiring_soon` + a
      follow-up task, deduped per expiry via migration `0012`)
- [x] At T-0: site → `expired`, slot → `cooldown` (via `releaseSlotForSite`),
      then the same cron sweeps `cooldown` → `free`
- [x] Expired URL serves a branded holding page, not a 404 (already wired —
      `HoldingPage kind="expired"` in `apps/sites`)
- [x] "Extend 7 days" action for live conversations (already wired —
      `extendDemoExpiryAction`)
- [x] Never auto-expire a lead in `interested` / `meeting` / `negotiation` —
      cron now joins lead status and postpones instead of expiring

**Done when:** the pool sustains itself with no manual cleanup.

---

## Phase 3 — Phone identity & reply attribution ✅

WhatsApp replies arrive as a bare phone number. Without canonical numbers,
inbound messages can't be matched to a lead.

- [x] Migration `0013_phone_identity.sql` — `phone_e164`, `whatsapp_e164`
      trigger-maintained columns (not `GENERATED ALWAYS AS`, so the
      normalization rule can change without a column rewrite) + partial
      indexes. **Not unique** — two leads can legitimately share a number;
      see the ambiguity rule below instead of a DB constraint
- [x] Backfill existing leads to E.164 (`+91…`) — one-time `update` in the
      migration
- [x] Normalize on every write path: the trigger fires on *any* insert/update
      to `phone`/`whatsapp`, so import, manual create, and Google Places all
      get normalized automatically with zero app-code changes
- [x] `findLeadByPhone(e164)` resolver (`packages/db/src/repositories/leads.ts`)
      — checks both `phone_e164` and `whatsapp_e164`; returns `ambiguous: true`
      instead of guessing when more than one active lead matches
- [x] Inbound direction on messages: `direction` enum (`outbound|inbound`,
      defaults `outbound`), `replied_at` on the lead

**Done when:** any Indian phone format resolves to exactly one lead.

---

## Phase 4 — Inbound webhook for n8n ✅

The single API surface n8n writes back to.

- [x] `POST /api/webhooks/whatsapp-inbound` — HMAC-SHA256 signed
      (`X-Webhook-Signature`, same scheme as the Razorpay webhook)
- [x] Resolves lead by `phone_e164`/`whatsapp_e164` via `findLeadByPhone`,
      stores an inbound message (`direction: "inbound"`), appends a
      `message_received` lead activity, fires an `inbound_reply` notification
- [x] Auto-advances status `whatsapp_sent`/`demo_viewed`/`waiting` →
      `interested` on first reply, never downgrades a lead already at
      `interested` or later
- [x] Delivery-status callback (`{"event":"status", ...}` →
      `sent / delivered / read(opened) / failed`), rank-gated so a
      re-delivered "sent" can't undo a "read"
- [x] Idempotent on `provider_message_id` (checked before insert, and before
      any status update)
- [x] Shared secret in Settings → API Keys → n8n / WhatsApp inbound,
      rotatable from the UI (`WHATSAPP_INBOUND_WEBHOOK_SECRET` env wins)
- [x] Ambiguous or unmatched numbers never auto-attach — flagged via an
      `inbound_reply_ambiguous` notification instead (the Phase 3 rule)

**Done when:** a POST from n8n shows up on the lead timeline within seconds.

---

## Phase 5 — Engagement signals on the lead timeline ✅

The strongest closing signal is "they opened the site". Tracking already
exists (`/api/track`) but never surfaces where decisions get made.

- [x] Lead detail: opened / not opened, first + last view, view count,
      time on page, which sections were read, CTA clicks — new
      `getSiteEngagement` in `packages/db/src/repositories/tracking.ts`,
      rendered as an "Engagement" card on the lead page
- [x] `demo_viewed` status auto-set on first real view (bots filtered) —
      this was already wired in `/api/track/visit`
- [x] Leads list: "viewed but silent" quick filter (`leads-toolbar.tsx`) —
      the highest-intent segment is exactly `status = demo_viewed` (viewed,
      hasn't progressed); Phase 4's inbound webhook already moves a lead
      off this status the moment they reply
- [x] Feed engagement into the existing health score — `runHealthScoreAction`
      now computes `conversion_score` from real CTA-click/visitor ratio and
      folds it into the overall score average

**Done when:** you can sort the pipeline by who actually looked.

---

## Phase 6 — n8n workflow ✅

Only now, once the app owns all the state.

- [x] Exportable workflow JSON committed to `integrations/n8n/`
      (`outbound-whatsapp.workflow.json`, `inbound-whatsapp.workflow.json`)
- [x] Outbound: n8n polls `GET /api/automation/outreach-queue` (new,
      HMAC-signed) → sends via WhatsApp Cloud API → reports back to
      `POST /api/automation/log-sent` (new, HMAC-signed)
- [x] Inbound: n8n's webhook receives replies/status callbacks → forwards
      to the Phase 4 webhook (`/api/webhooks/whatsapp-inbound`)
- [x] Follow-up ladder: rides the templates already seeded in Settings →
      Prompts — pitch → `day2` → `day5` → `day10` (final), each rung gated
      on the previous message's age with no reply; a lead falls off the
      instant it replies or advances past `waiting`
- [x] Quiet hours + per-day send cap — cron expression restricted to a
      sending window, `limit` param + a documented per-day counter pattern
      (see `integrations/n8n/README.md` §3)
- [x] Setup guide (`integrations/n8n/README.md`) covering the WhatsApp
      Cloud API approved-template requirement, the HMAC signing scheme,
      and step-by-step node configuration for both workflows

**Done when:** a lead moves from `website_generated` to a captured reply
without anyone touching a keyboard.

---

## Phase 7 — Won-deal migration ✅

- [x] Guided flow: attach client domain → Vercel domain add → DNS
      instructions → verify → flip site to `production` — this was already
      built (`convertLeadToClientAction`, `addDomainAction`,
      `verifyDomainAction`); Phase 7 wired the last step, the hand-off
- [x] 301 from the demo slot to the client domain during a grace window —
      `verifyDomainAction` now sets `redirect_to_domain` +
      `redirect_grace_ends_at` (14 days) on the site the moment the custom
      domain verifies; `apps/sites` issues a `permanentRedirect` for any
      visit to the old demo slug while the window is open
- [x] Release the slot back to the pool when the grace window ends —
      the Phase 2 cron (`/api/cron/expire-demos`) now also sweeps expired
      hand-offs and releases the slot with no cooldown (it was never shown
      to a new prospect during the redirect window)
- [x] Client handover pack (credentials, what they own, what renews) —
      `generateHandoverPackAction` renders a PDF (live URL, domain/renewal
      dates from the client record, ownership breakdown, support contact);
      download button on each client card in `/clients`

Migration `0015_domain_handoff.sql` adds the two new columns this needed.

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
