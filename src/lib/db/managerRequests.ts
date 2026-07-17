import { supabase } from '../supabase';

export interface ManagerRequest {
  id: string;
  userId: string;
  gymName: string;
  location: string;
  phone: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment: string | null;
  documentPhotoUrl: string | null;
  createdAt: string;
}

// ── Mock fallback ──────────────────────────────────────────

let mockRequests: ManagerRequest[] = [];

function rowToRequest(r: any): ManagerRequest {
  return {
    id:               r.id,
    userId:           r.user_id,
    gymName:          r.gym_name,
    location:         r.location,
    phone:            r.phone ?? '',
    message:          r.message ?? '',
    status:           r.status,
    adminComment:     r.admin_comment ?? null,
    documentPhotoUrl: r.document_photo_url ?? null,
    createdAt:        r.created_at,
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
  req: Pick<ManagerRequest, 'userId' | 'gymName' | 'location' | 'phone' | 'message'> & { documentPhotoUrl?: string | null },
): Promise<void> {
  const { error } = await supabase.from('manager_requests').insert({
    user_id:            req.userId,
    gym_name:           req.gymName,
    location:           req.location,
    phone:              req.phone,
    message:            req.message,
    status:             'pending',
    document_photo_url: req.documentPhotoUrl ?? null,
  });
  if (error) {
    mockRequests.push({
      id:               `mr${Date.now()}`,
      userId:           req.userId,
      gymName:          req.gymName,
      location:         req.location,
      phone:            req.phone,
      message:          req.message,
      status:           'pending',
      adminComment:     null,
      documentPhotoUrl: req.documentPhotoUrl ?? null,
      createdAt:        new Date().toISOString(),
    });
  }
}

export async function fetchManagerRequests(): Promise<ManagerRequest[]> {
  try {
    const { data, error } = await supabase
      .from('manager_requests')
      .select('id, user_id, gym_name, location, phone, message, status, admin_comment, document_photo_url, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(rowToRequest);
  } catch {
    return [];
  }
}

export async function updateManagerRequestStatus(
  id: string,
  status: 'approved' | 'rejected',
  adminComment?: string,
): Promise<{ error: string | null }> {
  try {
    const update: { status: string; admin_comment?: string } = { status };
    if (adminComment && adminComment.trim()) update.admin_comment = adminComment.trim();
    const { error } = await supabase
      .from('manager_requests')
      .update(update)
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}
