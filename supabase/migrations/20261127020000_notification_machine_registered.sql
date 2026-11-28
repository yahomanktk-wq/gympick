-- 2026-11-27: 매니저 머신 등록 신청 처리 완료 알림 타입 추가
-- 알림은 tools/machine-register(어드민 로그인)에서 등록을 마칠 때 직접 insert한다
-- (notifications_insert_admin 정책: is_admin()). related_id = gym_id → 앱에서 헬스장 상세로 이동
-- 같은 날 데이터 정리: machine_requests 4건 gym_id 'kyidax0'(없는 헬스장) → 'g_1795699816728'(GYMFINITY 짐피니티)
-- (DB 적용 완료. 기록용 — 다시 실행 금지)

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'manager_approved','manager_rejected','gym_request_reviewed','gym_request_resolved',
  'gym_report_reviewed','gym_manager_link_approved','gym_manager_link_rejected',
  'announcement','general','inquiry_answered','new_machine','ounwan_comment',
  'gym_review_reply','member_request','member_approved','member_rejected',
  'trainer_application','trainer_approved','trainer_rejected','ounwan_like',
  'qna_question','qna_answer','pt_request','pt_message',
  'gym_registered','gym_link_requested','machine_registered'
]::text[]));
