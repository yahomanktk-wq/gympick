-- (2026-11-16 Supabase에 이미 적용됨 — 기록용)
-- 프로필 사진 업로드(x-upsert)는 INSERT ... ON CONFLICT ... RETURNING 이라 SELECT 권한도 필요하다.
-- profile-images 버킷에 SELECT 정책이 없어 모든 업로드가 RLS 오류(400)로 실패하던 문제 수정.
create policy profile_images_select_own on storage.objects for select to authenticated
  using (bucket_id = 'profile-images' and (auth.uid())::text = (storage.foldername(name))[1]);
