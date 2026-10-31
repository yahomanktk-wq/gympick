-- 보안: 요청·피드백·올림픽 테이블의 열린 정책 정리 (2026-10-31)
-- 근거: 조사결과_open_rls_requests.md
--  - gym_registration_requests: 비로그인 전체 읽기·수정 → 본인/어드민 읽기, 본인 신청만, 수정·삭제는 어드민
--  - gym_manager_link_requests: 로그인 유저가 남의 요청 수정 → 본인/어드민 읽기, 본인 pending 신청만, 수정·삭제는 어드민
--  - machine_requests: 남의 요청 수정·신청자 위조 → 본인/어드민 읽기, 본인 pending 신청만, 수정·삭제는 어드민
--  - feedbacks: 비로그인 전체 읽기 → 읽기는 어드민만 (제출은 그대로)
--  - olympic_rankings / olympic_votes: 기능 미사용 → 클라이언트 쓰기 전부 차단 (읽기는 유지)
begin;

-- ── gym_registration_requests ──
drop policy if exists gym_req_admin_update on public.gym_registration_requests;
drop policy if exists gym_req_admin_read  on public.gym_registration_requests;
drop policy if exists gym_req_read_own    on public.gym_registration_requests;
drop policy if exists gym_req_insert      on public.gym_registration_requests;

create policy grr_select_own_or_admin on public.gym_registration_requests
  for select to authenticated
  using (user_id = (select auth.uid())::text or (select public.is_admin()));

-- 일반 신청: 본인·pending·user 역할만
-- 매니저 즉시등록 이력: 본인·reviewed·manager, 실제 role=manager일 때만
create policy grr_insert_own on public.gym_registration_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())::text
    and admin_comment is null
    and (
      (status = 'pending' and coalesce(requester_role, 'user') = 'user')
      or
      (status = 'reviewed' and requester_role = 'manager'
        and exists (select 1 from public.profiles p
                    where p.id = (select auth.uid()) and p.role = 'manager'))
    )
  );

create policy grr_update_admin on public.gym_registration_requests
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy grr_delete_admin on public.gym_registration_requests
  for delete to authenticated
  using ((select public.is_admin()));

-- ── gym_manager_link_requests ──
drop policy if exists "authenticated can update link requests"     on public.gym_manager_link_requests;
drop policy if exists "authenticated can select all link requests" on public.gym_manager_link_requests;
drop policy if exists "select own link request"                    on public.gym_manager_link_requests;
drop policy if exists "insert own link request"                    on public.gym_manager_link_requests;

create policy link_select_own_or_admin on public.gym_manager_link_requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or (select public.is_admin()));

create policy link_insert_own_pending on public.gym_manager_link_requests
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and admin_comment is null
  );

create policy link_update_admin on public.gym_manager_link_requests
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy link_delete_admin on public.gym_manager_link_requests
  for delete to authenticated
  using ((select public.is_admin()));

-- ── machine_requests ──
drop policy if exists machine_requests_update_auth on public.machine_requests;
drop policy if exists machine_requests_select_auth on public.machine_requests;
drop policy if exists machine_requests_insert_auth on public.machine_requests;

create policy mr_select_own_or_admin on public.machine_requests
  for select to authenticated
  using (requester_id = (select auth.uid())::text or (select public.is_admin()));

create policy mr_insert_own_pending on public.machine_requests
  for insert to authenticated
  with check (requester_id = (select auth.uid())::text and status = 'pending');

create policy mr_update_admin on public.machine_requests
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy mr_delete_admin on public.machine_requests
  for delete to authenticated
  using ((select public.is_admin()));

-- ── feedbacks: 읽기는 어드민만 (feedbacks_insert는 유지) ──
drop policy if exists feedbacks_select_admin on public.feedbacks;
create policy feedbacks_select_admin on public.feedbacks
  for select to authenticated
  using ((select public.is_admin()));

-- ── olympic: 클라이언트 쓰기 전부 차단 (읽기 정책은 유지) ──
drop policy if exists "Auth users can upsert rankings" on public.olympic_rankings;
drop policy if exists "Auth users can insert votes"    on public.olympic_votes;

commit;
