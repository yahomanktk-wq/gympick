-- ============================================================
-- GymPick — New Tables (manager_requests, notifications, gym_reports, profiles)
-- Run after supabase_1_tables.sql
-- ============================================================

-- ── User profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname    TEXT,
  name        TEXT NOT NULL DEFAULT '',
  birth_date  DATE,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'manager', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own"  ON profiles FOR SELECT  USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"  ON profiles FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE  USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all"   ON profiles FOR ALL     USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ── Manager registration requests ─────────────────────────
CREATE TABLE IF NOT EXISTS manager_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_name    TEXT NOT NULL,
  location    TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_requests_user_id ON manager_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_manager_requests_status  ON manager_requests(status);

ALTER TABLE manager_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mreq_select_own"   ON manager_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mreq_insert_own"   ON manager_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mreq_admin_all"    ON manager_requests FOR ALL    USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── In-app notifications ───────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'general',
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  read        BOOLEAN NOT NULL DEFAULT false,
  related_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read       ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own"  ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own"  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ── Gym info reports (제보) ────────────────────────────────
CREATE TABLE IF NOT EXISTS gym_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      TEXT NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL DEFAULT 'other',
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_reports_gym_id ON gym_reports(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_reports_status ON gym_reports(status);

ALTER TABLE gym_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "greport_insert_any"  ON gym_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "greport_admin_all"   ON gym_reports FOR ALL    USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
