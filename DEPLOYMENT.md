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

## 4b. Local dev (Option A — Supabase on your machine, FREE)

Until a second cloud project is worth it, **local = dev**. It runs entirely on your machine
(Docker), so it can never touch the cloud (prod) project. Requires **Docker Desktop running**.

**One-time:**
```bash
npx supabase init        # generates supabase/config.toml (keep existing files)
npx supabase start       # boots local Postgres + Auth + Studio (first run pulls images)
```
`supabase start` prints a local **API URL** (`http://127.0.0.1:54321`), an **anon key**, and the
**Studio URL** (`http://127.0.0.1:54323`). Migrations in `supabase/migrations/` are applied automatically.

**Make a local super-admin + mark the DB as dev:**
1. Open local **Studio** → Authentication → **Add user** (your email + password — auto-confirmed locally).
2. Studio → SQL Editor → run:
   ```sql
   update app_users set role='super_admin', tenant_id=null
   where id in (select id from auth.users where email='YOUR@EMAIL');
   ```
3. Studio → SQL Editor → run `supabase/dev-marker.sql` (marks this DB as dev → lets `reset.sql` run here).

**Point the app at local:** set `.env.local` to the values `supabase start` printed:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start>
```
Then `npm run dev` → you'll see the amber **● LOCAL DEV** badge → log in → create a test shop from the
console. (To test the login-management feature locally: `npx supabase functions serve manage-tenant-users`.)

**Wipe & restart local anytime (safe — it's local):**
```bash
npx supabase db reset    # re-applies migrations on the local DB
```
`reset.sql` is only needed for the dashboard SQL-editor flow; locally `db reset` does the same.

> **The golden rule:** `.env.local` and Supabase local = **dev**. The cloud project = **prod**, only
> ever changed via tested migration files. The **LOCAL DEV badge** + the **reset.sql safety guard**
> (refuses without the dev marker) make it impossible to confuse them or wipe prod by accident.

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
