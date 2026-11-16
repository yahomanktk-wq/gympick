-- (2026-11-16 Supabase에 이미 적용됨 — 기록용. 아래 일괄 생성 부분은 다시 실행하지 말 것)
-- 닉네임 자동 생성: "형용사 동물" (겹치면 다른 조합 → 그래도 겹치면 뒤에 숫자 2, 3 …)
create or replace function public.generate_unique_nickname(p_preferred text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  adjectives text[] := array['단단한','탄탄한','강인한','날렵한','묵직한','거대한','다부진',
    '열정적인','꾸준한','폭발적인','맹렬한','끈질긴','집중하는','도전하는',
    '철벽같은','파워풀한','불굴의','맹수같은','무적의','최강의','전설의','압도적인','위대한'];
  animals text[] := array['호랑이','사자','곰','늑대','독수리','고릴라','표범','치타','코뿔소','들소',
    '황소','매','상어','범고래','퓨마','재규어','하마','코끼리','여우','판다',
    '수달','펭귄','캥거루','말','얼룩말','기린','사슴','부엉이','너구리','다람쥐',
    '토끼','거북이','악어','고래','돌고래','물개','알파카','오소리','담비','멧돼지'];
  base text;
  candidate text;
  n int;
  i int := 0;
begin
  -- 사용자가 직접 정한 닉네임(예전 자동 생성 "형용사_숫자" 형식 제외)은 우선 사용
  if p_preferred is not null and btrim(p_preferred) <> ''
     and btrim(p_preferred) !~ '^[^_[:space:]]+_[0-9]{4}$'
     and not exists (select 1 from profiles where nickname = btrim(p_preferred)) then
    return btrim(p_preferred);
  end if;

  loop
    i := i + 1;
    base := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
            || ' ' || animals[1 + floor(random() * array_length(animals, 1))::int];
    if not exists (select 1 from profiles where nickname = base) then
      return base;
    end if;
    exit when i >= 30;
  end loop;

  n := 2;
  loop
    candidate := base || n::text;
    exit when not exists (select 1 from profiles where nickname = candidate);
    n := n + 1;
  end loop;
  return candidate;
end $$;
revoke all on function public.generate_unique_nickname(text) from public, anon, authenticated;

-- 프로필이 처음 만들어질 때 닉네임이 비어 있으면 서버가 자동으로 채움 (이메일·Apple·Google 공통)
create or replace function public.profiles_fill_nickname()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_meta text;
begin
  if new.nickname is null or btrim(new.nickname) = '' then
    select raw_user_meta_data->>'nickname' into v_meta from auth.users where id = new.id;
    new.nickname := public.generate_unique_nickname(v_meta);
  end if;
  return new;
end $$;
revoke all on function public.profiles_fill_nickname() from public, anon, authenticated;

drop trigger if exists trg_profiles_fill_nickname on public.profiles;
create trigger trg_profiles_fill_nickname before insert on public.profiles
  for each row execute function public.profiles_fill_nickname();

-- 기존 사용자: 닉네임이 없거나 예전 숫자형 자동 닉네임이면 새로 생성, 이미 올린 글의 표시 이름도 갱신
create temp table _nick_backfill (id uuid primary key, new_nick text) on commit drop;
do $$
declare r record; v_meta text; v_nick text;
begin
  for r in
    select p.id from profiles p
    where p.nickname is null or btrim(p.nickname) = '' or p.nickname ~ '^[^_[:space:]]+_[0-9]{4}$'
    order by p.created_at
  loop
    update profiles set nickname = null where id = r.id;
    select raw_user_meta_data->>'nickname' into v_meta from auth.users where id = r.id;
    v_nick := public.generate_unique_nickname(v_meta);
    update profiles set nickname = v_nick where id = r.id;
    insert into _nick_backfill values (r.id, v_nick);
  end loop;
end $$;
update workout_feed_posts t set nickname = b.new_nick from _nick_backfill b where t.user_id::text = b.id::text and t.nickname is distinct from b.new_nick;
update ounwan_comments   t set nickname = b.new_nick from _nick_backfill b where t.user_id::text = b.id::text and t.nickname is distinct from b.new_nick;
update gym_questions     t set nickname = b.new_nick from _nick_backfill b where t.user_id::text = b.id::text and t.nickname is distinct from b.new_nick;
update gym_answers       t set nickname = b.new_nick from _nick_backfill b where t.user_id::text = b.id::text and t.nickname is distinct from b.new_nick;
update gym_reviews       t set nickname = b.new_nick from _nick_backfill b where t.user_id::text = b.id::text and t.nickname is distinct from b.new_nick;
