-- gym_favorites 테이블 생성
CREATE TABLE IF NOT EXISTS gym_favorites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_id     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gym_id)
);

-- RLS 활성화
ALTER TABLE gym_favorites ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 읽기/쓰기 가능
CREATE POLICY "Users can manage their own gym favorites"
  ON gym_favorites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
