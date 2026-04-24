import { supabase } from '../supabase';

export type GymReportType =
  | 'wrong_hours'
  | 'wrong_address'
  | 'closed'
  | 'wrong_phone'
  | 'other';

export interface GymReport {
  id: string;
  gymId: string;
  userId?: string;
  reportType: GymReportType;
  message: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string;
}

// ── Mock fallback ──────────────────────────────────────────

let mockGymReports: GymReport[] = [];

function rowToReport(r: any): GymReport {
  return {
    id:         r.id,
    gymId:      r.gym_id,
    userId:     r.user_id ?? undefined,
    reportType: r.report_type,
    message:    r.message ?? '',
    status:     r.status,
    createdAt:  r.created_at,
  };
}

// ── Mutations ─────────────────────────────────────────────

export async function addGymReport(
  report: Pick<GymReport, 'gymId' | 'userId' | 'reportType' | 'message'>,
): Promise<void> {
  const { error } = await supabase.from('gym_reports').insert({
    gym_id:      report.gymId,
    user_id:     report.userId,
    report_type: report.reportType,
    message:     report.message,
    status:      'pending',
  });
  if (error) {
    mockGymReports.push({
      id:        `gr${Date.now()}`,
      ...report,
      status:    'pending',
      createdAt: new Date().toISOString(),
    });
  }
}

// ── Queries ────────────────────────────────────────────────

export async function getGymReports(gymId: string): Promise<GymReport[]> {
  const { data, error } = await supabase
    .from('gym_reports')
    .select('*')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false });
  if (error) return mockGymReports.filter(r => r.gymId === gymId);
  return (data ?? []).map(rowToReport);
}

export async function getAllGymReports(): Promise<GymReport[]> {
  const { data, error } = await supabase
    .from('gym_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [...mockGymReports];
  return (data ?? []).map(rowToReport);
}
