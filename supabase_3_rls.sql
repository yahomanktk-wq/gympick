-- =============================================================================
-- GymPick Supabase Schema
-- Safe to re-run: uses IF NOT EXISTS and ON CONFLICT DO NOTHING
-- =============================================================================

-- SECTION 3: ROW LEVEL SECURITY
-- =============================================================================

-- Public tables: readable by everyone (anon + authenticated)
ALTER TABLE gyms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gyms_select_public"         ON gyms;
DROP POLICY IF EXISTS "machines_select_public"     ON machines;
DROP POLICY IF EXISTS "gym_machines_select_public" ON gym_machines;

CREATE POLICY "gyms_select_public"
  ON gyms FOR SELECT USING (true);

CREATE POLICY "machines_select_public"
  ON machines FOR SELECT USING (true);

CREATE POLICY "gym_machines_select_public"
  ON gym_machines FOR SELECT USING (true);

-- User-specific tables: RLS with auth.uid()
ALTER TABLE workout_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_reviews   ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_machines ENABLE ROW LEVEL SECURITY;

-- workout_sessions
DROP POLICY IF EXISTS "workout_sessions_own" ON workout_sessions;
CREATE POLICY "workout_sessions_own"
  ON workout_sessions
  USING (CAST(auth.uid() AS TEXT) = user_id)
  WITH CHECK (CAST(auth.uid() AS TEXT) = user_id);

-- workout_entries (access via parent session)
DROP POLICY IF EXISTS "workout_entries_own" ON workout_entries;
CREATE POLICY "workout_entries_own"
  ON workout_entries
  USING (
    session_id IN (
      SELECT id FROM workout_sessions WHERE user_id = CAST(auth.uid() AS TEXT)
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM workout_sessions WHERE user_id = CAST(auth.uid() AS TEXT)
    )
  );

-- workout_sets (access via parent entry → session)
DROP POLICY IF EXISTS "workout_sets_own" ON workout_sets;
CREATE POLICY "workout_sets_own"
  ON workout_sets
  USING (
    entry_id IN (
      SELECT we.id FROM workout_entries we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE ws.user_id = CAST(auth.uid() AS TEXT)
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT we.id FROM workout_entries we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE ws.user_id = CAST(auth.uid() AS TEXT)
    )
  );

-- workout_photos
DROP POLICY IF EXISTS "workout_photos_own" ON workout_photos;
CREATE POLICY "workout_photos_own"
  ON workout_photos
  USING (CAST(auth.uid() AS TEXT) = user_id)
  WITH CHECK (CAST(auth.uid() AS TEXT) = user_id);

-- machine_reviews: anyone can read, owners can insert/update/delete
DROP POLICY IF EXISTS "machine_reviews_select_public" ON machine_reviews;
DROP POLICY IF EXISTS "machine_reviews_own_write"     ON machine_reviews;
CREATE POLICY "machine_reviews_select_public"
  ON machine_reviews FOR SELECT USING (true);
CREATE POLICY "machine_reviews_own_write"
  ON machine_reviews
  FOR ALL
  USING (CAST(auth.uid() AS TEXT) = user_id)
  WITH CHECK (CAST(auth.uid() AS TEXT) = user_id);

-- favorite_machines
DROP POLICY IF EXISTS "favorite_machines_own" ON favorite_machines;
CREATE POLICY "favorite_machines_own"
  ON favorite_machines
  USING (CAST(auth.uid() AS TEXT) = user_id)
  WITH CHECK (CAST(auth.uid() AS TEXT) = user_id);


-- =============================================================================
