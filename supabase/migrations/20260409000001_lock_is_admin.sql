-- Prevent clients from toggling is_admin on themselves (run after initial schema)

create or replace function public.protect_profile_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block self-elevation via the anon/authenticated API; SQL Editor runs with auth.uid() null.
  if auth.uid() is not null and tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin cannot be changed via the API';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_profiles_lock_is_admin on public.profiles;
create trigger tr_profiles_lock_is_admin
  before update on public.profiles
  for each row
  execute procedure public.protect_profile_is_admin();
