# Setup Instructions — Instant Business Website AI

Yeh file batati hai ki project chalane ke liye kya-kya karna hai. Hindi + English dono mein
seedha-saadha likha hai taaki koi step miss na ho.

---

## 1. Database setup (SIRF EK BAAR karna hai)

**File:** [`supabase/APPLY_ALL.sql`](supabase/APPLY_ALL.sql)

Isme migrations 0001–0010 (poora schema, RLS, audit logs, media category, notifications,
outreach, daily digest, health scores, renewal reminders) **aur** sample seed data (5 demo leads,
templates, ek live demo site, WhatsApp templates, AI prompts) — sab **ek hi file** mein merge kar
diya gaya hai.

**Kaise chalayen:**
1. Supabase Dashboard kholiye → apna project → left sidebar mein **SQL Editor**.
2. `supabase/APPLY_ALL.sql` file ka poora content copy karke paste karein.
3. **Run** dabayein.
4. Agar sample data (5 test leads) nahi chahiye, to file ke bottom wala **SEED** section
   (jahan `-- SEED — sample data` comment se shuru hota hai) delete karke run karein.

Yeh file sirf **ek baar** chalani hai. Migrations `if not exists` guards ke saath likhi hain,
isliye galti se dobara chalane par bhi zyada nuksaan nahi hoga — lekin phir bhi baar-baar chalane
ki zaroorat nahi.

Ab se koi bhi naya migration (Phase 10+) is combined file mein already add hoga — mujhe alag se
kehne ki zaroorat nahi, main khud is file ko update karta rahunga jab bhi koi naya migration aayega.

---

## 2. Environment variables (already set kiye hain, yahan sirf reference ke liye)

### `apps/admin/.env.local`

| Variable | Kya hai | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Aapka Supabase project URL | ✅ set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (secret) | ✅ set |
| `SETTINGS_ENCRYPTION_KEY` | API keys ko encrypt karne ke liye — generated | ✅ set |
| `NEXT_PUBLIC_BASE_DOMAIN` | Production domain (`aivexallp.com`) | ✅ set |
| `NEXT_PUBLIC_SITES_URL` | Renderer app ka URL (local: `localhost:3001`) | ✅ set |
| `REVALIDATE_SECRET` | Publish karne par cache turant refresh karne ke liye | ✅ set |
| `CRON_SECRET` | Demo-expiry daily cron ko protect karne ke liye | ✅ set |

### `apps/sites/.env.local`

Same Supabase keys + `REVALIDATE_SECRET` (admin wale se match hona chahiye) — already set hai.

---

## 3. Aapko khud jo daalna hai — Settings UI se (env var nahi)

App run karne ke baad `/settings/api-keys` page par jaake yeh keys daal sakte hain
(ya `.env.local` mein bhi daal sakte hain — dono chalega):

| Key | Kis Phase mein use hota hai | Zaroori hai kya? |
|---|---|---|
| **Anthropic (Claude) API key** | Phase 6 — AI website content generation | ✅ Haan, iske bina website generate nahi hogi |
| **Google Gemini API key** | Phase 6 — Claude fail ho to backup | ⚠️ Optional par recommended |
| **Cloudinary** (cloud name + API key + secret) | Phase 8 — image upload/media library | ⚠️ Optional — bina iske images upload nahi ho payengi |
| Resend API key | Phase 11 — email outreach | ⚠️ Optional — bina iske email nahi jayega |
| **PageSpeed Insights API key** | Phase 13 — website health score (Lighthouse scores) | ⚠️ Optional — bina iske Health Score button "not configured" bolega |
| **Razorpay keys** (Key ID + Key Secret + Webhook Secret) | Phase 14 — quotation payment links | ⚠️ Optional — bina iske payment link button error dega |

**Sabse zaroori abhi ke liye: Anthropic API key.** Baaki sab baad ke phases ke liye hain, jab
woh feature use karna ho tab daal dena — koi jaldi nahi.

### Custom domains (env var hi hai, Settings UI nahi) — Phase 14

Client ka apna domain (jaise `www.clientdomain.com`) connect karne ke liye teen env vars
`apps/admin/.env.local` mein chahiye (Settings UI mein nahi, kyunki yeh Vercel project-level
config hai):

| Variable | Kahan se milega |
|---|---|
| `VERCEL_API_TOKEN` | Vercel Dashboard → Settings → Tokens |
| `VERCEL_PROJECT_ID_SITES` | `apps/sites` project ka Vercel Project ID (Project Settings → General) |
| `VERCEL_TEAM_ID` | Sirf tab chahiye jab project ek Vercel Team ke andar ho |

Bina iske "Add domain" button `/clients` page par error dega — baaki sab (quotations, payments,
convert-to-client) bina iske bhi kaam karta hai.

---

## 4. App kaise chalayen (local development)

```bash
npm install
npm run dev:admin   # http://localhost:3000  (internal dashboard)
npm run dev:sites   # http://localhost:3001  (demo websites yahan render hote hain)
```

Pehli baar sign-in karne wala user automatically **owner** ban jaata hai.

---

## 5. Abhi tak kitna kaam ho chuka hai (Phase 1–15 — SAB PHASES COMPLETE)

- ✅ Foundation: auth, design system, settings
- ✅ Database: pura schema, RLS, audit logs
- ✅ Lead CRM: table, Kanban, map, bulk import, scoring
- ✅ Website templates: 5 templates, color/layout variants
- ✅ AI engine: Claude + Gemini failover, prompt manager
- ✅ Website generator + editor: AI se content banana, edit karna
- ✅ Media library: Cloudinary upload, stock images
- ✅ Deployment: publish, QR code, expiry cron, SEO
- ✅ Demo engagement tracking: visitor analytics, hot leads, notifications
- ✅ Outreach suite: WhatsApp pitch (AI-personalized), email (Resend + open tracking), PDF proposals
- ✅ Follow-up manager: list/calendar view, snooze/complete/cancel, auto-suggest on status change,
  daily digest cron (due follow-ups + hot leads + expiring demos)
- ✅ Analytics & Health Scores: funnel (stage-to-stage conversion), weekly activity, category/area
  performance, win-rate trend, AI cost vs revenue — sab CSV export ke saath. Website Health Score
  (Google PageSpeed Insights + AI audit) editor ke andar "Health score" button se run hota hai,
  branded PDF audit report client ke liye download ho sakta hai.
- ✅ Client Conversion, Domains & Payments: lead detail page se quotation banao (line items, GST
  toggle, PDF export, status: draft/sent/accepted/rejected), Razorpay payment link (advance/full)
  quotation se attach hota hai, webhook se payment status auto-update hota hai. Won lead ko
  "Convert to client" se permanent project banao — demo banner hatta, search indexing on hota hai.
  Naya **Clients** page: onboarding checklist, custom domain connect (Vercel Domains API — DNS
  instructions + verify), domain/renewal expiry tracking, maintenance/hosting notes. Renewal
  reminder cron 30/7/1 din pehle notify karta hai.

- ✅ Hardening & Launch: error boundaries har route par (login, dashboard, tenant sites — koi bhi
  crash ab Next ka default ugly error page nahi dikhayega), har major page par loading skeleton,
  email-open pixel rate-limited, revalidate secret ab constant-time compare karta hai. Settings
  mein naya **"Export full backup (JSON)"** button (owner-only) — poora database ek JSON file mein.
  Playwright E2E suite (`e2e/`) poora happy-path test karta hai: import → generate → deploy →
  track → convert. Do naye docs: `docs/RUNBOOK.md` (operations guide) aur
  `docs/ADDING_TEMPLATES.md` (naya template kaise add karein).

**Sab 15 phases complete hain — poora master plan ban chuka hai.** Ab se koi bhi naya kaam ho to
seedha bata dijiye, main turant shuru kar dunga.

**Naya (optional) key jo Phase 11 mein use hota hai:** Resend API key — Settings → API Keys →
"Resend" section. Iske bina email bhejna kaam nahi karega, lekin WhatsApp pitch aur PDF proposal
bina Resend ke bhi chalte hain.

**Naya (optional) key jo Phase 13 mein use hota hai:** Google PageSpeed Insights API key —
Settings → API Keys → "PageSpeed" section (ya `PAGESPEED_API_KEY` env var). Google Cloud Console
se free mein milti hai (PageSpeed Insights API enable karke). Iske bina Health Score button
"PageSpeed Insights isn't configured" error dega.

**Phase 15 mein E2E tests chalane ke liye:** `e2e/README.md` dekhein — isme real Claude aur
Supabase credentials chahiye, isliye yeh automatically nahi chalte, khud `npm run e2e` se chalane
padenge jab chahein.

---

## 6. Koi aur instruction / naya kaam batana ho to

Bas mujhe bata dijiye — agar wo instruction "hamesha ke liye follow karni hai" (jaise coding
style, naming convention, ya koi permanent rule), to main use is file mein ya memory mein save
kar lunga taaki future mein bhi yaad rahe. Agar sirf ek task ke liye hai, to seedha bata dijiye,
main turant kaam shuru kar dunga.
