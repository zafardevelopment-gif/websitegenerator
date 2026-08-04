# Instant Business Website AI

Internal platform for **AIVEXA LLP**: generate premium demo websites for local businesses in
minutes, deploy them on `*.aivexallp.com` subdomains, pitch via WhatsApp, track engagement, and
convert interested owners into paying clients.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — multi-tenant renderer decision, monorepo layout, env/setup
- [docs/SRS.md](docs/SRS.md) — modules, user stories, acceptance criteria, ERD

## Layout

```
apps/admin      → internal dashboard (app.aivexallp.com)
apps/sites      → multi-tenant website renderer (*.aivexallp.com)
packages/ui     → design system (tokens + components)
packages/db     → Supabase clients, types, repositories
packages/config → shared constants
supabase/       → versioned SQL migrations
```

## Getting started

```bash
npm install
# 1. Create apps/admin/.env.local from .env.example (Supabase keys + SETTINGS_ENCRYPTION_KEY)
# 2. Apply supabase/migrations/*.sql to your Supabase project (SQL editor or supabase CLI)
npm run dev:admin   # http://localhost:3000
npm run dev:sites   # http://localhost:3001 (try smiledental.localhost:3001)
```

All database tables are prefixed `aiwebsite_`.
