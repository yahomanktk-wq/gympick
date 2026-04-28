import { supabase } from '../supabase';

// -- Supabase SQL Editor에서 수동 실행 필요:
// CREATE TABLE IF NOT EXISTS gym_registration_requests (
//   id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
//   user_id    TEXT NOT NULL,
//   gym_name   TEXT NOT NULL,
//   location   TEXT NOT NULL,
//   notes      TEXT DEFAULT '',
//   status     TEXT NOT NULL DEFAULT 'pending'
//                CHECK (status IN ('pending', 'reviewed', 'resolved')),
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// ALTER TABLE gym_registration_requests ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "gym_req_insert" ON gym_registration_requests FOR INSERT WITH CHECK (auth.uid()::text = user_id);
// CREATE POLICY "gym_req_read_own" ON gym_registration_requests FOR SELECT USING (auth.uid()::text = user_id);

export interface GymRegistrationRequest {
  id:            string;
  userId:        string;
  gymName:       string;
  location:      string;
  notes:         string;
  status:        'pending' | 'reviewed' | 'resolved';
  requesterRole: 'user' | 'manager';
  createdAt:     string;
}

export async function submitGymRegistrationRequest(
  userId: string,
  gymName: string,
  location: string,
  notes: string,
  requesterRole: 'user' | 'manager' = 'user',
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('gym_registration_requests')
      .insert({
        user_id:        userId,
        gym_name:       gymName,
        location,
        notes,
        status:         'pending',
        requester_role: requesterRole,
      });
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message ?? '요청 중 오류가 발생했습니다.' };
  }
}

export async function fetchGymRegistrationRequests(): Promise<GymRegistrationRequest[]> {
  const { data, error } = await supabase
    .from('gym_registration_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(r => ({
    id:            r.id,
    userId:        r.user_id,
    gymName:       r.gym_name,
    location:      r.location,
    notes:         r.notes ?? '',
    status:        r.status,
    requesterRole: r.requester_role ?? 'user',
    createdAt:     r.created_at,
  }));
}

export async function updateGymRequestStatus(
  id: string,
  status: 'reviewed' | 'resolved',
): Promise<void> {
  await supabase
    .from('gym_registration_requests')
    .update({ status })
    .eq('id', id);
}
