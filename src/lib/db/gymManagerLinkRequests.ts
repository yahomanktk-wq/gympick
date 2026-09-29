import { supabase } from '../supabase';

export interface GymManagerLinkRequest {
  id:           string;
  gymId:        string;
  requesterId:  string;
  gymName:      string;
  status:       'pending' | 'approved' | 'rejected';
  adminComment: string | null;
  createdAt:    string;
}

function rowToLinkRequest(r: any): GymManagerLinkRequest {
  return {
    id:           r.id,
    gymId:        r.gym_id,
    requesterId:  r.requester_id,
    gymName:      r.gym_name,
    status:       r.status,
    adminComment: r.admin_comment ?? null,
    createdAt:    r.created_at,
  };
}

/** 기존 헬스장에 매니저로 연결해달라는 요청을 저장한다 (즉시 반영 아님 — 어드민 승인 필요). */
export async function submitGymManagerLinkRequest(
  requesterId: string,
  gymId:       string,
  gymName:     string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('gym_manager_link_requests').insert({
      id:           `link_${Date.now()}`,
      gym_id:       gymId,
      requester_id: requesterId,
      gym_name:     gymName,
      status:       'pending',
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? '요청 중 오류가 발생했습니다.' };
  }
}

/** 전체 매니저 연결 요청 조회 (최신순) */
export async function fetchGymManagerLinkRequests(): Promise<GymManagerLinkRequest[]> {
  try {
    const { data, error } = await supabase
      .from('gym_manager_link_requests')
      .select('id, gym_id, requester_id, gym_name, status, admin_comment, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(rowToLinkRequest);
  } catch {
    return [];
  }
}

/** 내가 제출한 매니저 연결 요청 내역 (최신순) — 프로필 "내 요청 내역"용 */
export async function fetchMyGymManagerLinkRequests(userId: string): Promise<GymManagerLinkRequest[]> {
  try {
    const { data, error } = await supabase
      .from('gym_manager_link_requests')
      .select('id, gym_id, requester_id, gym_name, status, admin_comment, created_at')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(rowToLinkRequest);
  } catch {
    return [];
  }
}

/** 매니저 연결 요청 승인/거절 처리 (다음 태스크의 어드민 사이드에서 사용) */
export async function updateGymManagerLinkRequestStatus(
  id:            string,
  status:        'approved' | 'rejected',
  adminComment?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const update: { status: string; admin_comment?: string } = { status };
    if (adminComment && adminComment.trim()) update.admin_comment = adminComment.trim();
    const { error } = await supabase
      .from('gym_manager_link_requests')
      .update(update)
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? '처리 중 오류가 발생했습니다.' };
  }
}
