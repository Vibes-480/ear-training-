-- Ear Trainer cloud sync: one row per user. Run once in the Supabase SQL Editor.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  configs  jsonb not null default '{}'::jsonb,
  presets  jsonb not null default '[]'::jsonb,
  extra    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "read own"   on public.user_data for select using (auth.uid() = user_id);
create policy "insert own" on public.user_data for insert with check (auth.uid() = user_id);
create policy "update own" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
