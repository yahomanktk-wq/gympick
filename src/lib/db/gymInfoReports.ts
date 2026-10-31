import { supabase } from '../supabase';

export interface GymInfoReport {
  id:              string;
  gymId:           string;
  gymName:         string;
  reporterUserId?: string;
  reportType:      string;
  content:         string;
  createdAt:       string;
  status:          'pending' | 'reviewed';
  adminComment:    string | null;
  /** "이 머신 없어요" 제보 대상 머신 id (그 외 유형은 빈 배열) */
  machineIds:      string[];
}

function rowTo(r: any): GymInfoReport {
  return {
    id:             r.id,
    gymId:          r.gym_id ?? '',
    gymName:        r.gym_name ?? '',
    reporterUserId: r.reporter_user_id ?? undefined,
    reportType:     r.report_type ?? 'other',
    content:        r.content ?? '',
    createdAt:      r.created_at,
    status:         (r.status ?? 'pending') as 'pending' | 'reviewed',
    adminComment:   r.admin_comment ?? null,
    machineIds:     Array.isArray(r.machine_ids) ? r.machine_ids : [],
  };
}

export async function fetchGymInfoReports(): Promise<GymInfoReport[]> {
  try {
    const { data, error } = await supabase
      .from('gym_info_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(rowTo);
  } catch (e: any) {
    if (__DEV__) console.warn('[gymInfoReports] fetch:', e?.message);
    return [];
  }
}

/** 내가 제출한 정보 제보 내역 (최신순) — 익명 제출(reporter_user_id 없음)은 제외 */
export async function fetchMyGymInfoReports(userId: string): Promise<GymInfoReport[]> {
  try {
    const { data, error } = await supabase
      .from('gym_info_reports')
      .select('*')
      .eq('reporter_user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(rowTo);
  } catch (e: any) {
    if (__DEV__) console.warn('[gymInfoReports] fetchMy:', e?.message);
    return [];
  }
}

export async function submitGymInfoReport(input: {
  gymId:            string;
  gymName:          string;
  reporterUserId?:  string;
  reportType:       string;
  content:          string;
  /** "이 머신 없어요" 유형일 때만 전달 */
  machineIds?:      string[];
}): Promise<{ error: string | null }> {
  try {
    const row: Record<string, unknown> = {
      gym_id:           input.gymId,
      gym_name:         input.gymName,
      reporter_user_id: input.reporterUserId ?? null,
      report_type:      input.reportType,
      content:          input.content,
      status:           'pending',
    };
    // 다른 유형 제보는 기존과 똑같은 컬럼만 보낸다
    if (input.machineIds && input.machineIds.length > 0) row.machine_ids = input.machineIds;
    const { error } = await supabase.from('gym_info_reports').insert(row);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? '제보 중 오류가 발생했습니다.' };
  }
}

export async function markReportReviewed(id: string, adminComment?: string): Promise<void> {
  const update: { status: string; admin_comment?: string } = { status: 'reviewed' };
  if (adminComment && adminComment.trim()) update.admin_comment = adminComment.trim();
  await supabase.from('gym_info_reports').update(update).eq('id', id);
}

export async function deleteGymInfoReport(id: string): Promise<void> {
  await supabase.from('gym_info_reports').delete().eq('id', id);
}
