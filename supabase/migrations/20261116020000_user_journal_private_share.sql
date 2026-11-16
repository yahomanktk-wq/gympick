-- (2026-11-16 Supabase에 이미 적용됨 — 기록용)
-- 유저 운동일지(프로필 화면) 1단계: 비공개 설정 · 공유 코드 · 조회 함수

-- 1) 프로필 칸
alter table public.profiles
  add column if not exists journal_private boolean not null default false,
  add column if not exists share_code text;
create unique index if not exists profiles_share_code_key on public.profiles (share_code) where share_code is not null;
alter table public.profiles drop constraint if exists profiles_share_code_format;
alter table public.profiles add constraint profiles_share_code_format
  check (share_code is null or share_code ~ '^[a-z0-9]{6,12}$');

-- 2) 비공개 여부 (RLS에서 사용)
create or replace function public.is_journal_private(p_user_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.journal_private from profiles p
    where p_user_id ~ '^[0-9a-fA-F-]{36}$' and p.id = p_user_id::uuid
  ), false);
$$;
revoke all on function public.is_journal_private(text) from public;
grant execute on function public.is_journal_private(text) to anon, authenticated;

-- 3) 오운완 조회 정책: 작성자가 운동일지 비공개면 본인·어드민만
drop policy if exists feed_posts_read_public on public.workout_feed_posts;
create policy feed_posts_read_public on public.workout_feed_posts for select using (
  (
    (visibility = 'public')
    or ((auth.uid())::text = user_id)
    or is_admin()
    or ((visibility = 'gym') and is_gym_member(gym_id, (auth.uid())::text))
  )
  and (
    ((auth.uid())::text = user_id) or is_admin() or not is_journal_private(user_id)
  )
  and not exists (
    select 1 from user_blocks b
    where b.blocker_id = (auth.uid())::text and b.blocked_id = workout_feed_posts.user_id
  )
);

-- 4) 남의(또는 내) 운동일지 헤더 정보 — 로그인 사용자 전용
create or replace function public.get_user_journal(p_user_id text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_me  text := (auth.uid())::text;
  v_row profiles%rowtype;
begin
  if v_me is null then
    raise exception 'login required';
  end if;
  if p_user_id is null or p_user_id !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  select * into v_row from profiles where id = p_user_id::uuid;
  if not found then
    return null;
  end if;
  return json_build_object(
    'user_id',    v_row.id,
    'nickname',   coalesce(nullif(btrim(v_row.nickname), ''), '짐픽 회원'),
    'avatar_url', v_row.avatar_url,
    'is_me',      v_row.id::text = v_me,
    'is_private', v_row.journal_private and v_row.id::text <> v_me,
    'is_blocked', exists (select 1 from user_blocks b where b.blocker_id = v_me and b.blocked_id = p_user_id),
    'share_code', case when v_row.id::text = v_me then v_row.share_code end
  );
end $$;
revoke all on function public.get_user_journal(text) from public, anon;
grant execute on function public.get_user_journal(text) to authenticated;

-- 5) 내 공유 코드 만들기(없으면 생성) — 6자리 소문자·숫자 (헷갈리는 0/o/1/l/i 제외)
create or replace function public.ensure_my_share_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_code  text;
  chars   text := 'abcdefghjkmnpqrstuvwxyz23456789';
  i       int;
  tries   int := 0;
begin
  if v_me is null then
    raise exception 'login required';
  end if;
  select share_code into v_code from profiles where id = v_me;
  if v_code is not null then
    return v_code;
  end if;
  loop
    tries := tries + 1;
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from profiles where share_code = v_code) or tries > 20;
  end loop;
  update profiles set share_code = v_code where id = v_me;
  return v_code;
end $$;
revoke all on function public.ensure_my_share_code() from public, anon;
grant execute on function public.ensure_my_share_code() to authenticated;

-- 6) 공유 링크(웹)용 공개 운동일지 — 로그인 없이 호출 가능, 전체 공개 오운완만
create or replace function public.get_public_journal(p_code text, p_limit int default 120)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_row profiles%rowtype;
begin
  if p_code is null or p_code !~ '^[a-z0-9]{6,12}$' then
    return null;
  end if;
  select * into v_row from profiles where share_code = p_code;
  if not found then
    return null;
  end if;
  if v_row.journal_private then
    return json_build_object(
      'nickname',   coalesce(nullif(btrim(v_row.nickname), ''), '짐픽 회원'),
      'avatar_url', v_row.avatar_url,
      'is_private', true,
      'posts',      '[]'::json
    );
  end if;
  return json_build_object(
    'nickname',   coalesce(nullif(btrim(v_row.nickname), ''), '짐픽 회원'),
    'avatar_url', v_row.avatar_url,
    'is_private', false,
    'posts', coalesce((
      select json_agg(x order by x.created_at desc) from (
        select f.id, f.gym_id, f.gym_name, f.photo_uri, f.composite_uri, f.thumbnail_uri,
               f.blurhash, f.muscles, f.created_at, f.like_count
        from workout_feed_posts f
        where f.user_id = v_row.id::text and f.visibility = 'public'
        order by f.created_at desc
        limit least(greatest(coalesce(p_limit, 120), 1), 300)
      ) x
    ), '[]'::json)
  );
end $$;
revoke all on function public.get_public_journal(text, int) from public;
grant execute on function public.get_public_journal(text, int) to anon, authenticated;
