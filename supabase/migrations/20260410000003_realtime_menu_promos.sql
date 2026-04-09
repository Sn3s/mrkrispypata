-- Broadcast menu_items + promos changes to Realtime so the storefront can live-refresh.
-- RLS still applies: anon only receives events for rows they can SELECT (e.g. active catalog).

do $pub$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'menu_items'
  ) then
    alter publication supabase_realtime add table public.menu_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'promos'
  ) then
    alter publication supabase_realtime add table public.promos;
  end if;
end $pub$;
