-- 보안: 추천 루틴(gym_routines)·오피셜 브랜드(gym_official_brands) 쓰기 권한 제한
-- 기존: 두 테이블 모두 ALL / USING true 정책이 있어 비로그인(anon)까지 누구나 쓰기 가능했음.
-- 변경: 읽기는 그대로 공개, 쓰기는 gym_routines = 어드민 또는 해당 헬스장 매니저,
--       gym_official_brands = 어드민만.
begin;

-- ── gym_routines ──
drop policy if exists gym_routines_all on public.gym_routines;

create policy gym_routines_select_public on public.gym_routines
  for select to anon, authenticated using (true);

create policy gym_routines_insert_admin_or_manager on public.gym_routines
  for insert to authenticated
  with check (
    (select public.is_admin())
    or exists (select 1 from public.gyms g
               where g.id = gym_routines.gym_id
                 and g.manager_id = (select auth.uid())::text)
  );

create policy gym_routines_update_admin_or_manager on public.gym_routines
  for update to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.gyms g
               where g.id = gym_routines.gym_id
                 and g.manager_id = (select auth.uid())::text)
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.gyms g
               where g.id = gym_routines.gym_id
                 and g.manager_id = (select auth.uid())::text)
  );

create policy gym_routines_delete_admin_or_manager on public.gym_routines
  for delete to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.gyms g
               where g.id = gym_routines.gym_id
                 and g.manager_id = (select auth.uid())::text)
  );

create index if not exists idx_gym_routines_gym_id on public.gym_routines (gym_id);

-- ── gym_official_brands ──
drop policy if exists official_brands_admin on public.gym_official_brands;
-- official_brands_read (SELECT, true) is kept as is

create policy official_brands_insert_admin on public.gym_official_brands
  for insert to authenticated with check ((select public.is_admin()));
create policy official_brands_update_admin on public.gym_official_brands
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy official_brands_delete_admin on public.gym_official_brands
  for delete to authenticated using ((select public.is_admin()));

commit;
