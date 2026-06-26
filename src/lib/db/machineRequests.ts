import { supabase } from '../supabase';

export interface MachineRequest {
  id:           string;
  gymId:        string | null;
  gymName:      string;
  requesterId:  string;
  brand:        string;
  machineName:  string;
  targetMuscle: string;
  photoUrl:     string | null;
  status:       'pending' | 'reviewed' | 'resolved';
  createdAt:    string;
}

export async function submitMachineRequest(input: {
  gymId:        string | null;
  gymName:      string;
  requesterId:  string;
  brand:        string;
  machineName:  string;
  targetMuscle: string;
  photoUrl:     string | null;
}): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('machine_requests')
      .insert({
        gym_id:        input.gymId,
        gym_name:      input.gymName,
        requester_id:  input.requesterId,
        brand:         input.brand || null,
        machine_name:  input.machineName,
        target_muscle: input.targetMuscle || null,
        photo_url:     input.photoUrl || null,
        status:        'pending',
      });
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message ?? '요청 중 오류가 발생했습니다.' };
  }
}

export async function fetchMachineRequests(): Promise<MachineRequest[]> {
  const { data, error } = await supabase
    .from('machine_requests')
    .select('id, gym_id, gym_name, requester_id, brand, machine_name, target_muscle, photo_url, status, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => ({
    id:           r.id,
    gymId:        r.gym_id ?? null,
    gymName:      r.gym_name,
    requesterId:  r.requester_id,
    brand:        r.brand ?? '',
    machineName:  r.machine_name,
    targetMuscle: r.target_muscle ?? '',
    photoUrl:     r.photo_url ?? null,
    status:       r.status,
    createdAt:    r.created_at,
  }));
}

export async function updateMachineRequestStatus(
  id: string,
  status: 'reviewed' | 'resolved',
): Promise<void> {
  await supabase
    .from('machine_requests')
    .update({ status })
    .eq('id', id);
}
