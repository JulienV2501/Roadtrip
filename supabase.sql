-- =========================
-- Roadtrip schema minimal
-- =========================
create extension if not exists pgcrypto;

-- Un trip = un JSON (simple et efficace pour démarrer)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_trips_updated_at on public.trips;
create trigger trg_trips_updated_at
before update on public.trips
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.trips enable row level security;

drop policy if exists "Trips: select own" on public.trips;
create policy "Trips: select own"
on public.trips for select
using (owner = auth.uid());

drop policy if exists "Trips: insert own" on public.trips;
create policy "Trips: insert own"
on public.trips for insert
with check (owner = auth.uid());

drop policy if exists "Trips: update own" on public.trips;
create policy "Trips: update own"
on public.trips for update
using (owner = auth.uid())
with check (owner = auth.uid());

drop policy if exists "Trips: delete own" on public.trips;
create policy "Trips: delete own"
on public.trips for delete
using (owner = auth.uid());

-- Storage
-- 1) crée un bucket PRIVATE nommé: trip-files
-- 2) (optionnel) tu peux ajouter des policies Storage plus strictes
