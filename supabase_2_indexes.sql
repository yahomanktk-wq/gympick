-- =============================================================================
-- GymPick Supabase Schema
-- Safe to re-run: uses IF NOT EXISTS and ON CONFLICT DO NOTHING
-- =============================================================================

-- SECTION 2: INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_machines_target_muscle ON machines(target_muscle);
CREATE INDEX IF NOT EXISTS idx_machines_brand         ON machines(brand);

CREATE INDEX IF NOT EXISTS idx_gym_machines_gym_id     ON gym_machines(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_machines_machine_id ON gym_machines(machine_id);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id    ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_created_at ON workout_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_workout_entries_session_id ON workout_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_entry_id      ON workout_sets(entry_id);
CREATE INDEX IF NOT EXISTS idx_workout_photos_session_id  ON workout_photos(session_id);
CREATE INDEX IF NOT EXISTS idx_machine_reviews_machine_id ON machine_reviews(machine_id);

CREATE INDEX IF NOT EXISTS idx_favorite_machines_user_id    ON favorite_machines(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_machines_machine_id ON favorite_machines(machine_id);


-- =============================================================================
