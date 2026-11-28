-- 2026-11-28: 브랜드 로고를 Supabase Storage에서 불러오기 위한 brands 표 + brand-logos 버킷
-- (DB에는 MCP apply_migration으로 적용 완료. 기록용)
create table if not exists public.brands (
  key           text primary key,              -- 예: LIFE_FITNESS
  display_name  text not null,
  logo_path     text,                          -- brand-logos 버킷 경로, 예: LIFE_FITNESS/ve983c02b595e.webp (null = 로고 없음)
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);
alter table public.brands enable row level security;
drop policy if exists brands_select_all on public.brands;
create policy brands_select_all on public.brands for select using (true);
drop policy if exists brands_admin_insert on public.brands;
create policy brands_admin_insert on public.brands for insert with check (public.is_admin());
drop policy if exists brands_admin_update on public.brands;
create policy brands_admin_update on public.brands for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists brands_admin_delete on public.brands;
create policy brands_admin_delete on public.brands for delete using (public.is_admin());

create or replace function public.brands_touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists brands_touch on public.brands;
create trigger brands_touch before update on public.brands for each row execute function public.brands_touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-logos', 'brand-logos', true, 1048576, array['image/webp','image/png'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/webp','image/png'];

drop policy if exists brand_logos_admin_select on storage.objects;
create policy brand_logos_admin_select on storage.objects for select to authenticated using (bucket_id = 'brand-logos' and public.is_admin());
drop policy if exists brand_logos_admin_insert on storage.objects;
create policy brand_logos_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'brand-logos' and public.is_admin());
drop policy if exists brand_logos_admin_update on storage.objects;
create policy brand_logos_admin_update on storage.objects for update to authenticated using (bucket_id = 'brand-logos' and public.is_admin()) with check (bucket_id = 'brand-logos' and public.is_admin());
drop policy if exists brand_logos_admin_delete on storage.objects;
create policy brand_logos_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'brand-logos' and public.is_admin());

-- 기존 번들 로고 62개 (파일은 tools/brand-logos-upload/ 에서 대시보드로 업로드)
insert into public.brands (key, display_name, logo_path)
select k, replace(k, '_', ' '), k || '/ve983c02b595e.webp'
from unnest(array['ARSENAL','ATLANTIS','BODY_MASTER','BOOTY_BUILDER','CITADEL','CROSS_AXES_TECH','CYBEX','DEFIANT_STRENGTH','DRAX','DYNA_BODY','DYNA_FORCE','DYNAMIC','FLEX_FITNESS','FLEX_LEVERAGE','FORWARD','FREEMOTION','GLUTEBUILDER','GYM80','GYMLECO','HAMMER_STRENGTH','HARA_SPORTS','HOIST','ICARIAN','IKK_SPORTS','IMAGINE_STRENGTH','INTENZA','IRON_CORE','KING_STRENGTH','LEGEND_FITNESS','LEXCO','LIFE_FITNESS','MAGNUM','MATRIX','MAXPUMP','MEDX','MEGAMASS','NAUTILUS','NEBULA','NEWTECH','PANATTA','PARAMOUNT','PHD','POWER_LIFT','PRECOR','PRIME','QUANTUM','REAL_READER_USA','REPCON','ROGERS','ROSEN','SALUS','SEGYM','SINCO','SOUTHERN_STRENGTH','STAR_TRAC','STRIVE','TECHNOGYM','TELJU','TRUE','UNIVERSAL','USP','WATSON']) as k
on conflict (key) do nothing;

-- 로고가 아직 없는 DB 브랜드 (logo_path null)
insert into public.brands (key, display_name)
select distinct on (upper(regexp_replace(brand, '\s+', '_', 'g'))) upper(regexp_replace(brand, '\s+', '_', 'g')), upper(brand)
from public.machines
where brand is not null and brand not in ('NONE', 'Free Weight')
on conflict (key) do nothing;
