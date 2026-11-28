-- 2026-11-27: 매니저가 기존 헬스장 연결을 요청하면 어드민 전원에게 앱 안 알림
-- 문서: claude/새헬스장등록-어드민알림-조사및계획-2026-11-26.md
-- (DB 적용 완료. 기록용 — 다시 실행 금지)

-- 1) CHECK 제약에 새 type 추가 (기존 25종 + gym_link_requested)
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'manager_approved','manager_rejected','gym_request_reviewed','gym_request_resolved',
  'gym_report_reviewed','gym_manager_link_approved','gym_manager_link_rejected',
  'announcement','general','inquiry_answered','new_machine','ounwan_comment',
  'gym_review_reply','member_request','member_approved','member_rejected',
  'trainer_application','trainer_approved','trainer_rejected','ounwan_like',
  'qna_question','qna_answer','pt_request','pt_message',
  'gym_registered','gym_link_requested'
]::text[]));

-- 2) 연결 요청이 들어오면 어드민 전원에게 (요청자 본인 제외)
create or replace function public.notify_gym_link_requested()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nick text;
begin
  if new.status is distinct from 'pending' then return new; end if;
  begin
    select coalesce(nullif(nickname, ''), '매니저') into v_nick from profiles where id = new.requester_id;
    insert into notifications (user_id, type, title, body, related_id)
    select p.id::text,
           'gym_link_requested',
           '헬스장 연결 요청',
           coalesce(new.gym_name, '헬스장') || ' · ' || coalesce(v_nick, '매니저') || '님이 관리를 요청했어요',
           new.gym_id
      from profiles p
     where p.role = 'admin'
       and p.id is distinct from new.requester_id;
  exception when others then
    -- 알림 실패가 연결 요청을 막지 않도록
    raise warning 'notify_gym_link_requested failed: %', sqlerrm;
  end;
  return new;
end $$;

create trigger trg_notify_gym_link_requested
  after insert on public.gym_manager_link_requests
  for each row execute function public.notify_gym_link_requested();
