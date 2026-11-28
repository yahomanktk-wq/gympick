-- 2026-11-27: 매니저가 새 헬스장을 직접 등록하면 어드민 전원에게 앱 안 알림
-- 문서: claude/새헬스장등록-어드민알림-조사및계획-2026-11-26.md
-- (DB 적용 완료. 기록용 — 다시 실행 금지)

-- 1) CHECK 제약에 새 type 추가 (기존 24종 + gym_registered)
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'manager_approved','manager_rejected','gym_request_reviewed','gym_request_resolved',
  'gym_report_reviewed','gym_manager_link_approved','gym_manager_link_rejected',
  'announcement','general','inquiry_answered','new_machine','ounwan_comment',
  'gym_review_reply','member_request','member_approved','member_rejected',
  'trainer_application','trainer_approved','trainer_rejected','ounwan_like',
  'qna_question','qna_answer','pt_request','pt_message',
  'gym_registered'
]::text[]));

-- 2) 매니저가 직접 등록했을 때만 (어드민 등록·승인, SQL 직접 실행은 제외)
create or replace function public.notify_gym_registered()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then return new; end if;
  select role into v_role from profiles where id = v_uid;
  if v_role is distinct from 'manager' then return new; end if;
  if new.manager_id is distinct from v_uid::text then return new; end if;

  begin
    insert into notifications (user_id, type, title, body, related_id)
    select p.id::text,
           'gym_registered',
           '새 헬스장 등록',
           new.name || ' · ' || new.location
             || coalesce(' ' || nullif(new.address_detail, ''), ''),
           new.id
      from profiles p
     where p.role = 'admin'
       and p.id <> v_uid;
  exception when others then
    -- 알림 실패가 헬스장 등록을 막지 않도록
    raise warning 'notify_gym_registered failed: %', sqlerrm;
  end;
  return new;
end $$;

create trigger trg_notify_gym_registered
  after insert on public.gyms
  for each row execute function public.notify_gym_registered();
