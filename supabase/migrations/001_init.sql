-- Mandarin app: synced user data.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- Every table stores one JSON document per row (`data`), owned by the signed-in
-- user. `updated_at` is the device's change time (ms); `server_updated_at` is set
-- by the database and is what devices use to fetch "what's new since last time".

create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['progress', 'review_items', 'review_logs', 'settings', 'custom_packs', 'game_scores']
  loop
    execute format($f$
      create table if not exists public.%1$I (
        user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
        id text not null,
        data jsonb not null,
        updated_at bigint not null,
        server_updated_at timestamptz not null default clock_timestamp(),
        primary key (user_id, id)
      );
      create index if not exists %1$s_pull_idx on public.%1$I (user_id, server_updated_at);
      alter table public.%1$I enable row level security;
      drop policy if exists "own rows" on public.%1$I;
      create policy "own rows" on public.%1$I
        for all to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
      drop trigger if exists touch on public.%1$I;
      create trigger touch before insert or update on public.%1$I
        for each row execute function public.touch_server_updated_at();
    $f$, t);
  end loop;
end $$;
