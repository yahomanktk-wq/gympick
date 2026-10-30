-- 헬스장 영어 이름(slug) 규칙 변경: 하이픈(-) → 언더바(_)
-- 영어 소문자·숫자·언더바만, 3~30자, 언더바로 시작·끝 불가. NULL 허용은 그대로.
alter table public.gyms drop constraint if exists gyms_slug_format_chk;

alter table public.gyms
  add constraint gyms_slug_format_chk
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$');
