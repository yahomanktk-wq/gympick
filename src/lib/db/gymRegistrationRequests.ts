import { supabase } from '../supabase';
import { geocodeAddress } from '../geocoding';

export interface GymRegistrationRequest {
  id:            string;
  userId:        string;
  gymName:       string;
  location:      string;
  addressDetail: string | null;
  notes:         string;
  hours:         string | null;
  status:        'pending' | 'reviewed' | 'resolved';
  requesterRole: 'user' | 'manager';
  adminComment:  string | null;
  createdAt:     string;
}

export async function submitGymRegistrationRequest(
  userId:        string,
  gymName:       string,
  location:      string,
  addressDetail: string,
  notes:         string,
  requesterRole: 'user' | 'manager' = 'user',
  hours:         string = '',
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
        hours:          hours || null,
        status:         'pending',
        requester_role: requesterRole,
      });
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message ?? '요청 중 오류가 발생했습니다.' };
  }
}

/**
 * 승인된 매니저 전용 — 어드민 심사 없이 gyms 테이블에 즉시 등록한다.
 * AdminDashboard.tsx의 handleApproveGym이 하는 gyms insert와 동일한 형태로 넣고,
 * gym_registration_requests에도 감사/이력 추적용 레코드를 남기되 상태를 처음부터
 * 'reviewed'로 저장해 어드민 승인 큐(status === 'pending')에 뜨지 않도록 한다.
 * 이미 매니저 권한이 있는 유저만 호출 가능한 화면에서 쓰이므로 profiles.role 동기화는 하지 않는다.
 */
export async function registerGymImmediately(
  managerId:     string,
  name:          string,
  location:      string,
  addressDetail: string,
  notes:         string,
  hours:         string,
): Promise<{ success: boolean; gymId?: string; error?: string }> {
  try {
    const coords  = await geocodeAddress(location);
    const newGymId = `g_${Date.now()}`;

    const { error } = await supabase.from('gyms').insert({
      id:             newGymId,
      name,
      location,
      address_detail: addressDetail || null,
      description:    notes || '',
      hours:          hours || null,
      manager_id:     managerId,
      latitude:       coords?.latitude  ?? null,
      longitude:      coords?.longitude ?? null,
    });

    if (error) return { success: false, error: error.message };

    const { error: reqError } = await supabase.from('gym_registration_requests').insert({
      user_id:        managerId,
      gym_name:       name,
      location,
      address_detail: addressDetail || null,
      notes:          notes || null,
      hours:          hours || null,
      status:         'reviewed',
      requester_role: 'manager',
    });
    if (reqError && __DEV__) {
      console.warn('[gymRegistrationRequests] registerGymImmediately 이력 저장 실패:', reqError.message);
    }

    return { success: true, gymId: newGymId };
  } catch (e: any) {
    return { success: false, error: e.message ?? '헬스장 등록 중 오류가 발생했습니다.' };
  }
}

export async function fetchGymRegistrationRequests(): Promise<GymRegistrationRequest[]> {
  const { data, error } = await supabase
    .from('gym_registration_requests')
    .select('id, gym_name, location, address_detail, notes, hours, status, user_id, requester_role, admin_comment, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => ({
    id:            r.id,
    userId:        r.user_id,
    gymName:       r.gym_name,
    location:      r.location,
    addressDetail: r.address_detail ?? null,
    notes:         r.notes ?? '',
    hours:         r.hours ?? null,
    status:        r.status,
    requesterRole: r.requester_role ?? 'user',
    adminComment:  r.admin_comment ?? null,
    createdAt:     r.created_at,
  }));
}

/** 내가 제출한 헬스장 등록 제안 내역 (최신순) */
export async function fetchMyGymRegistrationRequests(userId: string): Promise<GymRegistrationRequest[]> {
  const { data, error } = await supabase
    .from('gym_registration_requests')
    .select('id, gym_name, location, address_detail, notes, hours, status, user_id, requester_role, admin_comment, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r: any) => ({
    id:            r.id,
    userId:        r.user_id,
    gymName:       r.gym_name,
    location:      r.location,
    addressDetail: r.address_detail ?? null,
    notes:         r.notes ?? '',
    hours:         r.hours ?? null,
    status:        r.status,
    requesterRole: r.requester_role ?? 'user',
    adminComment:  r.admin_comment ?? null,
    createdAt:     r.created_at,
  }));
}

export async function updateGymRequestStatus(
  id: string,
  status: 'reviewed' | 'resolved',
  adminComment?: string,
): Promise<void> {
  const update: { status: string; admin_comment?: string } = { status };
  if (adminComment && adminComment.trim()) update.admin_comment = adminComment.trim();
  await supabase
    .from('gym_registration_requests')
    .update(update)
    .eq('id', id);
}
