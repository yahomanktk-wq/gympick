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

export async function submitGymInfoReport(input: {
  gymId:            string;
  gymName:          string;
  reporterUserId?:  string;
  reportType:       string;
  content:          string;
}): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('gym_info_reports').insert({
      gym_id:           input.gymId,
      gym_name:         input.gymName,
      reporter_user_id: input.reporterUserId ?? null,
      report_type:      input.reportType,
      content:          input.content,
      status:           'pending',
    });
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
