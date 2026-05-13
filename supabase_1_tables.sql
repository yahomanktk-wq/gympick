-- =============================================================================
-- GymPick Supabase Schema
-- Safe to re-run: uses IF NOT EXISTS and ON CONFLICT DO NOTHING
-- =============================================================================

-- SECTION 1: CREATE TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- gyms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gyms (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- machines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machines (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  display_name  TEXT,
  brand         TEXT NOT NULL,
  target_muscle TEXT NOT NULL,
  category      TEXT NOT NULL,
  exercise_kind TEXT NOT NULL DEFAULT 'machine',
  copyright     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- gym_machines  (join table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gym_machines (
  gym_id      TEXT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  machine_id  TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  unit_count  INTEGER NOT NULL DEFAULT 1,
  condition   TEXT NOT NULL DEFAULT 'good',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (gym_id, machine_id)
);

-- ---------------------------------------------------------------------------
-- workout_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sessions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT NOT NULL,
  gym_id      TEXT NOT NULL REFERENCES gyms(id),
  date        TIMESTAMPTZ NOT NULL,
  body_weight NUMERIC,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- workout_entries  (note: "sort_order" not "order" — SQL reserved word)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_entries (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id    TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  machine_id    TEXT NOT NULL,
  machine_name  TEXT NOT NULL,
  machine_brand TEXT NOT NULL,
  target_muscle TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  exercise_kind TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- workout_sets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sets (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  entry_id    TEXT NOT NULL REFERENCES workout_entries(id) ON DELETE CASCADE,
  set_number  INTEGER NOT NULL,
  weight      NUMERIC NOT NULL,
  reps        INTEGER NOT NULL,
  is_pr       BOOLEAN,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- workout_photos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_photos (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id   TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  captured_at  TIMESTAMPTZ NOT NULL,
  text_color   TEXT NOT NULL DEFAULT 'White',
  aspect_ratio TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- machine_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machine_reviews (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  machine_id    TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  user_initials TEXT NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- favorite_machines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorite_machines (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT NOT NULL,
  machine_id  TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, machine_id)
);


-- =============================================================================
