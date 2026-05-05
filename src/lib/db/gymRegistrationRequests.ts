import { supabase } from '../supabase';

export interface GymRegistrationRequest {
  id:            string;
  userId:        string;
  gymName:       string;
  location:      string;
  addressDetail: string | null;
  notes:         string;
  status:        'pending' | 'reviewed' | 'resolved';
  requesterRole: 'user' | 'manager';
  createdAt:     string;
}

export async function submitGymRegistrationRequest(
  userId:        string,
  gymName:       string,
  location:      string,
  addressDetail: string,
  notes:         string,
  requesterRole: 'user' | 'manager' = 'user',
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('gym_registration_requests')
      .insert({
        user_id:        userId,
        gym_name:       gymName,
        location,
        address_detail: addressDetail || null,
        notes:          notes || null,
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
    .select('id, gym_name, location, address_detail, notes, status, user_id, requester_role, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => ({
    id:            r.id,
    userId:        r.user_id,
    gymName:       r.gym_name,
    location:      r.location,
    addressDetail: r.address_detail ?? null,
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
