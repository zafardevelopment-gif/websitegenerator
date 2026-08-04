# E2E happy-path tests (Playwright)

Covers the full lifecycle in one spec (`happy-path.spec.ts`): **import → generate → deploy →
track → convert**. This exercises real Claude AI generation, a real Supabase project, and both
`apps/admin` and `apps/sites` running — it is not run in CI by default and needs live credentials.

## Prerequisites

1. Both apps running against the **same** Supabase project you'll test against:
   ```bash
   npm run dev:admin   # http://localhost:3000
   npm run dev:sites   # http://localhost:3001
   ```
2. An Anthropic API key configured (Settings → API Keys or `ANTHROPIC_API_KEY`) — website
   generation calls Claude for real.
3. A team member already exists in Supabase Auth (Authentication → Users) — the very first
   signup becomes the owner automatically; every test run after that reuses this account.
4. Install browsers once: `npx playwright install chromium`.

## Environment variables

Set these in your shell (or a `.env` loaded before running):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase project the app points at |
| `SUPABASE_SERVICE_ROLE_KEY` | Used to generate a real login OTP without checking an inbox |
| `E2E_TEST_EMAIL` | An existing team member's email — the suite logs in as this user |
| `E2E_ADMIN_URL` | Defaults to `http://localhost:3000` |
| `E2E_SITES_URL` | Defaults to `http://localhost:3001` |

The suite never touches your inbox: `e2e/lib/supabase-admin.ts` calls
`supabase.auth.admin.generateLink({ type: "magiclink", email })`, which returns the same 6-digit
`email_otp` that would otherwise be emailed, and types it into the real login form. This drives
the actual login UI end-to-end rather than bypassing it.

## Running

```bash
npm run e2e        # headless
npm run e2e:ui     # Playwright's interactive UI mode
```

If `E2E_TEST_EMAIL` isn't set, the spec skips itself with a clear reason instead of failing.

## What it does NOT cover

Given this is a single happy-path spec (per the master plan's scope for Phase 15), it does not
cover: error states, concurrent edits, WhatsApp/email sending (external providers), Razorpay
payment webhooks, or custom-domain DNS verification. Those are better covered by targeted manual
QA per the checklists at the end of each phase's build.
