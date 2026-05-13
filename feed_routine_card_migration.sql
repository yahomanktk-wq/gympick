-- ============================================================
-- Supabase SQL Editor에서 실행할 것
-- workout_feed_posts 테이블에 routine_card_uri 컬럼 추가
-- ============================================================
ALTER TABLE workout_feed_posts
ADD COLUMN IF NOT EXISTS routine_card_uri TEXT;
