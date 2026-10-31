-- 2026-10-31
-- 1) 헬스장 보유 머신 변경 이력 (매니저 허위 입력 대응의 기반)
--    gym_machines에 행이 추가/삭제될 때마다 누가·언제·무엇을 바꿨는지 자동 기록.
--    앱 코드가 아니라 트리거로 기록해 어느 화면에서 바꾸든 빠지지 않는다.
--    기록은 어드민만 조회 가능, 클라이언트는 쓰기·수정·삭제 불가(정책 없음).
-- 2) 정보 제보에 "이 머신 없어요" 대상 머신 id 목록 칸 추가
begin;

create table if not exists public.gym_machine_changes (
  id              bigint generated always as identity primary key,
  gym_id          text        not null,           -- 헬스장 삭제 후에도 이력이 남도록 FK 없음
  machine_id      text        not null,
  action          text        not null check (action in ('added', 'removed')),
  changed_by      uuid,                           -- 서버(서비스 키) 작업이면 null
  changed_by_role text,                           -- 변경 시점의 profiles.role
  changed_at      timestamptz not null default now()
);

create index if not exists idx_gym_machine_changes_gym_time
  on public.gym_machine_changes (gym_id, changed_at desc);
create index if not exists idx_gym_machine_changes_changed_by
  on public.gym_machine_changes (changed_by);

alter table public.gym_machine_changes enable row level security;

drop policy if exists gmc_select_admin on public.gym_machine_changes;
create policy gmc_select_admin on public.gym_machine_changes
  for select to authenticated
  using ((select public.is_admin()));
-- INSERT/UPDATE/DELETE 정책 없음 → 클라이언트에서는 쓰기 불가. 기록은 아래 트리거만 남긴다.

create or replace function public.log_gym_machine_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
begin
  if v_uid is not null then
    select role into v_role from public.profiles where id = v_uid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.gym_machine_changes (gym_id, machine_id, action, changed_by, changed_by_role)
    values (new.gym_id, new.machine_id, 'added', v_uid, v_role);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.gym_machine_changes (gym_id, machine_id, action, changed_by, changed_by_role)
    values (old.gym_id, old.machine_id, 'removed', v_uid, v_role);
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.log_gym_machine_change() from public, anon, authenticated;

drop trigger if exists trg_log_gym_machine_change on public.gym_machines;
create trigger trg_log_gym_machine_change
  after insert or delete on public.gym_machines
  for each row execute function public.log_gym_machine_change();

-- 2) 제보 대상 머신 id 목록 ("이 머신 없어요" 유형에서 사용, 그 외 유형은 null)
alter table public.gym_info_reports
  add column if not exists machine_ids text[];

commit;
