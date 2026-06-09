# Khatape — Deployment & Environments

Goal: a safe **local → dev → production** pipeline where **production data is never put at risk**.

The frontend is a static SPA — deploying it never touches data. **All data risk is on the Supabase
(database) side**, so the safety rules are about (a) separate Supabase projects and (b) versioned,
forward-only migrations applied **dev first, then prod**.

---

## 1. Environments

| | Local | Dev / Staging | Production |
|---|---|---|---|
| Frontend | `npm run dev` (localhost) | Vercel — `dev` branch | Vercel — `main` branch |
| Supabase project | dev project (or Supabase CLI local) | **khatape-dev** | **khatape-prod** |
| Data | throwaway | throwaway / test | **REAL — protected** |
| Env vars | `.env.local` | Vercel (Preview) | Vercel (Production) |

Create **two Supabase projects**: `khatape-dev` and `khatape-prod` (Project Settings → API gives each
its own URL + anon key).

---

## 2. One-time setup

### a. Git + GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
git checkout -b dev && git push -u origin dev   # staging branch
```

### b. Both Supabase projects — apply the schema
For **each** project (dev, then prod) run the schema once:
- Easiest: Supabase dashboard → SQL Editor → paste `supabase/migrations/0001_init.sql` → Run.
- Or via CLI: `supabase link --project-ref <ref>` then `supabase db push`.

Then deploy the Edge Function to **each** project:
- Dashboard → Edge Functions → create `manage-tenant-users` → paste
  `supabase/functions/manage-tenant-users/index.ts` → Deploy.

Seed **dev only** (never prod) with `supabase/seed.sql`. Create your super-admin login(s) in each
project under Authentication → Users.

### c. Vercel
1. Import the GitHub repo into Vercel (framework: **Vite**, build `npm run build`, output `dist`).
2. **Environment Variables** — set the same two keys with different values per environment:
   - **Production** (used by `main`):
     - `VITE_SUPABASE_URL` = khatape-**prod** URL
     - `VITE_SUPABASE_ANON_KEY` = khatape-**prod** anon key
   - **Preview** (used by `dev` / PRs):
     - `VITE_SUPABASE_URL` = khatape-**dev** URL
     - `VITE_SUPABASE_ANON_KEY` = khatape-**dev** anon key
3. `main` branch → Production deployment. `dev` branch → Preview (staging) deployment.

> The anon key is safe in the browser (RLS protects data). The **service-role key is NEVER** in the
> frontend — it only lives inside each project's Edge Functions automatically.

---

## 3. Day-to-day workflow

```
1. Code locally           → .env.local points at khatape-dev (or CLI local)
                            npm run dev ; npm test ; npm run build
2. Push to `dev`          → Vercel auto-deploys staging (khatape-dev data)
                            test end-to-end with throwaway data
3. Merge dev → main       → Vercel auto-deploys production (khatape-prod data)
4. Schema changed?        → see §4 (apply the SAME migration to prod after dev passes)
```

---

## 4. Database changes (the only thing that can hurt prod) — the safe rule

1. Write the change as a **new migration file**: `supabase/migrations/000N_description.sql`.
   - **Forward-only & idempotent**: use `create table if not exists`,
     `alter table ... add column if not exists`, `create or replace view/function`.
   - **Never** `drop` data-bearing columns/tables in a prod migration without a backup + plan.
2. Apply to **khatape-dev** → test the app against it.
3. Only after it works on dev, apply the **same file** to **khatape-prod**.
4. **`supabase/reset.sql` is LOCAL/DEV ONLY.** Never run it on prod (it drops everything).

### Existing ad-hoc SQL → migrations
`0001_init.sql` already contains the full current schema (it's the folded version of all the
`add_*.sql` files). Going forward, add changes as new numbered migrations rather than ad-hoc files.

---

## 5. Production data safety net

- **Supabase Pro → enable Daily Backups + Point-in-Time Recovery (PITR)** on khatape-prod. Any
  mistake is then recoverable.
- *(Optional, cleanest)* **Supabase Branching**: spins up a temporary copy-DB per git branch so you
  test migrations without touching prod, then merge. Requires Pro + GitHub integration.
- Keep **dev and prod credentials separate** — never point a local/staging build at prod keys.

---

## 6. Pre-launch checklist

- [ ] Both Supabase projects created; `0001_init.sql` run on each.
- [ ] `manage-tenant-users` Edge Function deployed to both.
- [ ] Super-admin login(s) created + promoted (seed/SQL) in prod.
- [ ] Vercel env vars set for Production (prod) and Preview (dev).
- [ ] Backups/PITR enabled on prod.
- [ ] `npm run build` and `npm test` green.
- [ ] (Recommended before real client) finish invoice page branding (read UPI/shop name from Settings)
      and the pending UI redesign.
