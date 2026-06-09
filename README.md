# Khatape

Multi-tenant **POS + khaata ledger** for Indian dairy & grocery shops.

Tap an RFID card → buy **packaged *and* loose goods** (milk by the litre, grain by the kilo) → it goes on the customer's **running khaata** → close it with a **monthly or bulk invoice** (WhatsApp + thermal receipt). One operator runs many shops and switches modules on **per shop**.

## Stack
- **Frontend:** React 19 + Vite 7 + Tailwind v4 (SPA)
- **Backend:** Supabase — Postgres + Row-Level Security + Auth + Realtime + Edge Functions
- **Core logic:** pure, unit-tested JavaScript in `src/lib/` (money in integer paise, pricing, units, module entitlements, validation, bulk import)
- **Tests:** Vitest

## Getting started
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # run the domain-core test suite
```
Create `.env.local`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## What makes it robust
- **Real tenant isolation** via Postgres RLS — a shop can never see another shop's data.
- **Money is integer paise** end to end — no floating-point drift across thousands of customers.
- **Loose + packaged** pricing with unit conversion and rupee-first entry.
- **Per-tenant modules** — new features ship dark and are granted to specific shops only.
- **Multi-data tested** — bulk import handles 2000+ mixed valid/invalid rows without crashing.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and build order, and [`docs/TEST-PLAN.md`](./docs/TEST-PLAN.md) for the test catalogue.
