-- Mandarin app: "report bad audio" queue (redesign, Oct 2026).
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Same layout as the other tables (see 001_init.sql).
-- The re-recording job on GitHub reads and updates it with the service key.

create table if not exists public.audio_reports (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at bigint not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
create index if not exists audio_reports_pull_idx on public.audio_reports (user_id, server_updated_at);
alter table public.audio_reports enable row level security;
drop policy if exists "own rows" on public.audio_reports;
create policy "own rows" on public.audio_reports
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop trigger if exists touch on public.audio_reports;
create trigger touch before insert or update on public.audio_reports
  for each row execute function public.touch_server_updated_at();
