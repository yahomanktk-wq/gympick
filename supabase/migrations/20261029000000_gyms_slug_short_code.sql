-- gyms: 짧은 URL용 slug(선택, 영문) + short_code(자동 생성, 변경 불가) 추가
--   https://gympick.kr/{slug}
--   https://gympick.kr/g/{short_code}
-- RLS 정책은 변경하지 않음 (기존: admin 또는 해당 헬스장 매니저가 행 UPDATE 가능).
-- anon/authenticated 모두 gyms 테이블 단위 SELECT 권한이 있어 컬럼별 GRANT는 불필요.

-- 1. 컬럼
alter table public.gyms add column slug text;
alter table public.gyms add column short_code text;

-- 2. slug 규칙
create or replace function public.is_reserved_gym_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(p_slug) = any (array[
    -- 기본 예약어
    'g', 'gym', 'gyms', 'api', 'assets', 'static', 'public', 'images', 'img', 'css', 'js', 'fonts',
    'privacy', 'terms', 'admin', 'manager', 'login', 'signup', 'auth', 'www', 'app', 'index', 'home',
    'about', 'help', 'support', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'well-known', '.well-known',
    -- 웹 저장소 최상위 경로/파일명 (gympick-web)
    'brandlogos', 'brandscreen', 'config', 'detail', 'logo', 'modal', 'muscles', 'ounwan', 'store',
    'supabase', 'styles', 'og-image', 'readme', 'vercel',
    -- 조사 보고서 권장 예약어
    'download', 'favicon', 'robots', 'sitemap'
  ]::text[]);
$$;

alter table public.gyms
  add constraint gyms_slug_format_chk
    check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  add constraint gyms_slug_not_reserved_chk
    check (slug is null or not public.is_reserved_gym_slug(slug));

create unique index gyms_slug_key on public.gyms (slug) where slug is not null;

-- 3. short_code 생성
create or replace function public.generate_gym_short_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.gyms where short_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.gyms_assign_short_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.short_code is null then
    new.short_code := public.generate_gym_short_code();
  end if;
  return new;
end;
$$;

create trigger gyms_assign_short_code
  before insert on public.gyms
  for each row execute function public.gyms_assign_short_code();

-- 4. short_code 변경 금지 (NULL → 값 최초 할당만 허용)
create or replace function public.gyms_protect_short_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.short_code is not null and new.short_code is distinct from old.short_code then
    raise exception '짧은 코드는 변경할 수 없습니다';
  end if;
  return new;
end;
$$;

create trigger gyms_protect_short_code
  before update on public.gyms
  for each row execute function public.gyms_protect_short_code();

-- 5. 백필 (행마다 순차 실행되어 기존 코드와의 중복을 피함; 최종 보장은 unique 인덱스)
do $$
declare
  r record;
begin
  for r in select id from public.gyms where short_code is null loop
    update public.gyms set short_code = public.generate_gym_short_code() where id = r.id;
  end loop;
end;
$$;

create unique index gyms_short_code_key on public.gyms (short_code);

alter table public.gyms
  add constraint gyms_short_code_format_chk
    check (short_code ~ '^[23456789abcdefghjkmnpqrstuvwxyz]{6}$');

alter table public.gyms alter column short_code set not null;
