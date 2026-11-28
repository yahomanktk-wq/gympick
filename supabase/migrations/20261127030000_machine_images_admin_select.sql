-- 2026-11-27: machine-images 버킷 어드민 SELECT 정책 추가
-- upsert(x-upsert: true) 업로드는 INSERT·UPDATE에 더해 SELECT 권한도 필요하다.
-- 없어서 tools/machine-register의 'DB에 바로 등록'이 "new row violates row-level security policy"(403)로 실패했다.
-- (1.4.4 profile-images와 같은 원인. 어드민 앱의 '머신 사진 교체'(upsert)도 같은 이유로 막혀 있었을 수 있음)
-- (DB 적용 완료. 기록용 — 다시 실행 금지)
create policy machine_images_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'machine-images' and public.is_admin());
