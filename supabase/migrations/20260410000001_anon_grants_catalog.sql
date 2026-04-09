-- PostgREST reads as anon/authenticated; ensure catalog tables are selectable (safe if already granted)
grant select on table public.branches to anon, authenticated;
grant select on table public.menu_items to anon, authenticated;
grant select on table public.promos to anon, authenticated;
