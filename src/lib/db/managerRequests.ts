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
    // .select('id') is required here — without it, Supabase/PostgREST returns
    // error: null even when RLS silently filters the row out and 0 rows are
    // actually updated. Selecting back the affected row(s) lets us tell a real
    // update apart from a no-op one.
    const { data, error } = await supabase
      .from('manager_requests')
      .update(update)
      .eq('id', id)
      .select('id');
    if (error) return { error: error.message };
    if (!data || data.length === 0) {
      return { error: '업데이트된 항목이 없어요 (권한 또는 존재하지 않는 신청일 수 있어요).' };
    }
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}
