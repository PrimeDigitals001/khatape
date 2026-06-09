-- Khatape — DEV MARKER. Run this ONCE on a LOCAL / DEV database only.
-- NEVER run it on production. It marks the database as "dev" so that the
-- destructive reset.sql is allowed to run here (reset refuses on any DB without
-- this marker — i.e., production stays protected).

create table if not exists public._khatape_env (env text primary key);
insert into public._khatape_env (env) values ('dev') on conflict do nothing;
