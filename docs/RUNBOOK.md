# Instant Business Website AI — Runbook

**Companion docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [SRS.md](./SRS.md) · [ADDING_TEMPLATES.md](./ADDING_TEMPLATES.md)

Operational reference for running, deploying, and debugging the platform. Setup for a fresh
environment (accounts, env vars, database) is in [`SETUP.md`](../SETUP.md) at the repo root —
this document assumes that's already done and covers day-to-day operation.

---

## 1. Local development

```bash
npm install
npm run dev:admin   # http://localhost:3000 — internal dashboard
npm run dev:sites   # http://localhost:3001 — multi-tenant renderer
```

Both must run simultaneously for anything involving demo sites (generating, publishing,
previewing). The admin app calls the sites app's `/api/revalidate` on publish/update, and reads
`NEXT_PUBLIC_SITES_URL` to build demo links.

Sign-in is email + 6-digit OTP (Supabase Auth) — no password. The first person to sign up becomes
the **owner**; everyone after that must be invited first (Supabase Dashboard → Authentication →
Users → Invite user), or they'll see "This email is not on the team."

---

## 2. Deploying to production

Two separate Vercel projects point at the same repo:

| Project | Root directory | Domain |
|---|---|---|
| `admin` | `apps/admin` | `app.aivexallp.com` |
| `sites` | `apps/sites` | `aivexallp.com` + `*.aivexallp.com` |

Pushing to `main` builds and deploys both (Turborepo scopes the build per project via
`--filter`, but Vercel's own root-directory setting is what actually isolates each project's
build). A change to `packages/templates` or `packages/ui` triggers both projects to redeploy
since both depend on them; a change to only `apps/admin` redeploys just `admin`.

**Before merging to `main`:**
1. `npm run build` and `npm run typecheck` both pass locally (`turbo` runs across all workspaces).
2. If you touched anything security- or auth-adjacent, re-read §6 below.
3. If the change affects the happy path, run the Playwright suite locally (`e2e/README.md`) —
   it isn't wired into CI (needs live Claude/Supabase credentials) so this is a manual gate.

**Rolling back:** Vercel keeps every deployment; use "Promote to Production" on the last-known-good
deployment in the dashboard for either project independently. A renderer rollback does not require
rolling back admin, and vice versa — they're decoupled by design (see ARCHITECTURE.md §2.2).

---

## 3. Database migrations

All schema changes are versioned SQL files in `supabase/migrations/000N_*.sql`, applied once via
Supabase's SQL Editor. `supabase/APPLY_ALL.sql` is every migration concatenated in order plus the
seed script — used for spinning up a fresh environment in one paste (see `SETUP.md`).

**Adding a new migration:**
1. Write `supabase/migrations/00NN_description.sql` — additive only (new tables/columns/enum
   values). Never edit a migration that's already been applied anywhere.
2. Append it to `supabase/APPLY_ALL.sql` in the same position (before the `SEED` section), and
   bump the header comment's migration range.
3. Update `packages/db/src/types.ts` (row types + the `Tables` map) to match.
4. Run the new SQL against your own Supabase project's SQL Editor.

There is no automated migration runner — this is a deliberate simplicity trade-off for a
single-tenant internal tool (see ARCHITECTURE.md ADR-6 for how this stays mechanical if/when it
needs to become a real migration pipeline).

---

## 4. Cron jobs (Vercel Cron)

Defined in `apps/admin/vercel.json`, all guarded by `CRON_SECRET` (bearer token or `?secret=`
query param):

| Route | Schedule | What it does |
|---|---|---|
| `/api/cron/expire-demos` | daily 21:30 UTC | Flips live demo sites past `demo_expires_at` to `expired`, revalidates their cache tag |
| `/api/cron/daily-digest` | daily 02:00 UTC | One notification summarizing due follow-ups, hot leads, and demos expiring within 3 days |
| `/api/cron/renewal-reminders` | daily 03:00 UTC | Notifies at exactly 30/7/1 days before a client's domain or renewal date |

**Testing a cron manually:** `curl "https://app.aivexallp.com/api/cron/expire-demos?secret=$CRON_SECRET"`
— safe to run anytime; every cron is idempotent (re-running with nothing due is a no-op).

**If a cron silently stops firing:** check Vercel's Cron Jobs tab for the project (`admin`) — a
failed/timed-out invocation shows there with logs. All three routes return JSON with a `ranAt`
timestamp on success, so a healthy run is easy to confirm from the response body.

---

## 5. Common operational tasks

### Inviting a new team member
Supabase Dashboard → Authentication → Users → Invite user. They sign in with the OTP flow like
everyone else. Role defaults to `viewer`; promote via the `aiwebsite_users` table (owner/admin/
viewer) — there's no UI for role management yet (tracked as a future Settings enhancement).

### Rotating a secret (API key, webhook secret)
- **Env-only secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `SETTINGS_ENCRYPTION_KEY`, `CRON_SECRET`):
  rotate in the provider dashboard, update the Vercel project's env vars, redeploy.
  ⚠️ Rotating `SETTINGS_ENCRYPTION_KEY` invalidates every encrypted setting (AI keys, Cloudinary,
  Resend, Razorpay) — you'll need to re-enter all of them in Settings → API Keys afterward.
- **Settings-table secrets** (AI provider keys, Cloudinary, Resend, Razorpay): Settings →
  API Keys → clear the field, paste the new value, save. Takes effect immediately (no redeploy).

### Restoring from a backup
Settings → General → "Export full backup (JSON)" (owner only) downloads every table as one JSON
file, with secret setting values redacted. There is no automated *restore* script — a restore is
a manual, table-by-table re-insert against the JSON (matching the FK-safe order the export uses:
parents before children). Re-enter redacted API keys manually afterward.

### A tenant site is showing the wrong content / stale content
Publishing/editing already triggers `revalidateTag('site:<slug>')` on the renderer automatically.
If it's still stale: confirm `REVALIDATE_SECRET` matches between `apps/admin/.env.local` and
`apps/sites/.env.local` — a mismatch fails silently (deployment log will show
`revalidate HTTP 401` or "renderer unreachable"). Worst case, the 5-minute ISR window
self-heals.

### A custom domain won't verify
Clients page → the domain card shows the exact DNS record(s) Vercel expects (usually a CNAME to
`cname.vercel-dns.com`). DNS propagation can take up to 48 hours in rare cases; "Check
verification" is safe to click repeatedly. If `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID_SITES` aren't
set, the whole feature no-ops with a clear "not configured" error rather than a silent failure.

---

## 6. Security checklist (re-verify after any auth/data-access change)

This mirrors the master-plan security checklist — re-read this list whenever you touch auth,
RLS policies, a server action's input handling, or anything that reads/writes secrets:

- [ ] Every server action validates its input with `zod` (`.safeParse`, never trust the client).
- [ ] Every new table has RLS enabled, with policies using the shared `aiwebsite_is_team()` /
      `aiwebsite_is_editor()` helpers rather than ad-hoc conditions.
- [ ] Secrets are read env-var-first, decrypted-setting-second (see any file in
      `apps/admin/lib/server/*.ts` for the pattern) — never hardcoded, never logged.
- [ ] Any new public (unauthenticated) route handler either: verifies a signature (webhooks),
      checks a shared secret (crons, revalidate), or is rate-limited (tracking endpoints) —
      constant-time comparison for shared secrets, not `!==`.
- [ ] AI-generated content is never rendered via `dangerouslySetInnerHTML` — it flows through
      typed `SiteContent` fields as plain React children/props, which auto-escapes.
- [ ] File uploads use signed, server-generated signatures (Cloudinary) — the API secret never
      reaches the client.
- [ ] New Server Actions rely on Next.js's built-in Origin-header CSRF protection — don't add a
      raw `fetch`-based mutation endpoint that bypasses it.

---

## 7. Where things live (quick index)

| Concern | Location |
|---|---|
| Server actions (mutations) | `apps/admin/lib/actions/*.ts` |
| External API clients (Claude, Cloudinary, Razorpay, Vercel Domains, PageSpeed, Resend) | `apps/admin/lib/server/*.ts` |
| DB repositories (only place `.from()` is called) | `packages/db/src/repositories/*.ts` |
| RLS policies + schema | `supabase/migrations/*.sql`, combined in `supabase/APPLY_ALL.sql` |
| Website templates | `packages/templates/src/*` |
| Design system / UI primitives | `packages/ui/src/components/*` |
| Cron routes | `apps/admin/app/api/cron/*/route.ts` |
| Webhooks | `apps/admin/app/api/webhooks/*/route.ts` |
| E2E tests | `e2e/` (see `e2e/README.md`) |
