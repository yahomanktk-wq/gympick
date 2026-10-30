-- 1) Nickname duplicate check without exposing other users' rows
create or replace function public.is_nickname_taken(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where nickname = trim(p_nickname)
      and id <> auth.uid()
  );
$$;

revoke all on function public.is_nickname_taken(text) from public, anon;
grant execute on function public.is_nickname_taken(text) to authenticated;

-- 2) DB-level uniqueness (protects old app versions too)
create unique index if not exists profiles_nickname_key
  on public.profiles (nickname)
  where nickname is not null;

-- 3) Replace the open SELECT policy
drop policy if exists profiles_select_authenticated on public.profiles;

create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using ( id = auth.uid() or public.is_admin() );
