import { supabase } from '../supabase';

export interface ManagerRequest {
  id: string;
  userId: string;
  gymName: string;
  location: string;
  phone: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// ── Mock fallback ──────────────────────────────────────────

let mockRequests: ManagerRequest[] = [];

function rowToRequest(r: any): ManagerRequest {
  return {
    id:        r.id,
    userId:    r.user_id,
    gymName:   r.gym_name,
    location:  r.location,
    phone:     r.phone ?? '',
    message:   r.message ?? '',
    status:    r.status,
    createdAt: r.created_at,
  };
}

// ── Queries ────────────────────────────────────────────────

export async function getManagerRequests(userId: string): Promise<ManagerRequest[]> {
  const { data, error } = await supabase
    .from('manager_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return mockRequests.filter(r => r.userId === userId);
  return (data ?? []).map(rowToRequest);
}

export async function addManagerRequest(
  req: Pick<ManagerRequest, 'userId' | 'gymName' | 'location' | 'phone' | 'message'>,
): Promise<void> {
  const { error } = await supabase.from('manager_requests').insert({
    user_id:  req.userId,
    gym_name: req.gymName,
    location: req.location,
    phone:    req.phone,
    message:  req.message,
    status:   'pending',
  });
  if (error) {
    mockRequests.push({
      id:        `mr${Date.now()}`,
      ...req,
      status:    'pending',
      createdAt: new Date().toISOString(),
    });
  }
}

export async function fetchManagerRequests(): Promise<ManagerRequest[]> {
  try {
    const { data, error } = await supabase
      .from('manager_requests')
      .select('id, user_id, gym_name, location, phone, message, status, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((r: any) => ({
      id:        r.id,
      userId:    r.user_id,
      gymName:   r.gym_name,
      location:  r.location  ?? '',
      phone:     r.phone     ?? '',
      message:   r.message   ?? '',
      status:    r.status    ?? 'pending',
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function updateManagerRequestStatus(
  id: string,
  status: 'approved' | 'rejected',
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('manager_requests')
      .update({ status })
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteManagerRequest(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('manager_requests')
      .delete()
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteManagerRequestsByUserId(userId: string): Promise<void> {
  try {
    await supabase
      .from('manager_requests')
      .delete()
      .eq('user_id', userId);
  } catch {}
}
