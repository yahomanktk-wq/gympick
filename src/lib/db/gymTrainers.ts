import { supabase } from '../supabase';

// 2026-11-09: 헬스장 트레이너
// - 관장님 계정은 헬스장당 1개 (gyms.manager_id), 트레이너는 관장님이 승인해서 권한을 준다
// - 일반 유저가 헬스장 상세에서 신청 (실명 + 한 줄 소개)
// - 2026-11-09: 승인되면 실명·소개가 헬스장 상세 트레이너 목록에 공개된다. 소개는 트레이너가 수정 가능
// - 트레이너 권한: 배지 달린 댓글·답변 / PT 상담 응대 (헬스장 정보·머신·회원 승인은 관장님만)
// - 트레이너는 그 헬스장 회원으로 취급
// - 댓글 배지는 서버(트리거)가 정한다. 그만둬도 이미 단 댓글의 배지는 유지

export const TRAINER_NAME_MAX  = 20;
export const TRAINER_INTRO_MAX = 60;

export type TrainerStatus = 'trainer' | 'pending' | 'none';

export interface TrainerApplicationRow {
  id:        string;
  userId:    string;
  nickname:  string;
  realName:  string;
  intro:     string;
  createdAt: string;
}

export interface GymStaffRow {
  userId:    string;
  nickname:  string;
  realName:  string;
  intro:     string;
  grantedAt: string;
}

export interface PublicTrainer {
  userId:   string;
  nickname: string;
  realName: string;
  intro:    string;
}

/** 내 트레이너 상태 (트레이너 / 신청 대기 / 없음) */
export async function fetchMyTrainerStatus(gymId: string, userId: string | null | undefined): Promise<TrainerStatus> {
  if (!userId) return 'none';
  const [{ data: staff }, { data: app }] = await Promise.all([
    supabase.from('gym_staff').select('gym_id').eq('gym_id', gymId).eq('user_id', userId).maybeSingle(),
    supabase.from('gym_trainer_applications').select('id').eq('gym_id', gymId).eq('user_id', userId).eq('status', 'pending').maybeSingle(),
  ]);
  if (staff) return 'trainer';
  if (app) return 'pending';
  return 'none';
}

export async function applyGymTrainer(gymId: string, realName: string, intro: string): Promise<'ok' | 'duplicate' | 'already'> {
  const { error } = await supabase.rpc('apply_gym_trainer', {
    p_gym_id: gymId,
    p_real_name: realName.trim().slice(0, TRAINER_NAME_MAX),
    p_intro: intro.trim().slice(0, TRAINER_INTRO_MAX),
  });
  if (!error) return 'ok';
  if (error.message?.includes('already_staff')) return 'already';
  if (error.code === '23505') return 'duplicate';
  throw error;
}

export async function cancelMyTrainerApplication(gymId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('gym_trainer_applications')
    .delete()
    .eq('gym_id', gymId).eq('user_id', userId).eq('status', 'pending');
  if (error) throw error;
}

/** 본인 그만두기 또는 관장님 권한 해제 (DB 권한 규칙이 둘 다 허용) */
export async function removeGymTrainer(gymId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('gym_staff').delete().eq('gym_id', gymId).eq('user_id', userId);
  if (error) throw error;
}

/** 누구나: 트레이너 목록 (실명·소개 공개) */
export async function fetchGymTrainers(gymId: string): Promise<PublicTrainer[]> {
  const { data, error } = await supabase.rpc('list_gym_trainers', { p_gym_id: gymId });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    userId: r.user_id, nickname: r.nickname, realName: r.real_name ?? r.nickname, intro: r.intro ?? '',
  }));
}

// ── 관장님 ────────────────────────────────────────────────────────────────

export async function fetchTrainerApplications(gymId: string): Promise<TrainerApplicationRow[]> {
  const { data, error } = await supabase.rpc('list_gym_trainer_applications', { p_gym_id: gymId });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id, userId: r.user_id, nickname: r.nickname, realName: r.real_name, intro: r.intro, createdAt: r.created_at,
  }));
}

export async function fetchGymStaffAdmin(gymId: string): Promise<GymStaffRow[]> {
  const { data, error } = await supabase.rpc('list_gym_staff_admin', { p_gym_id: gymId });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    userId: r.user_id, nickname: r.nickname, realName: r.real_name, intro: r.intro, grantedAt: r.granted_at,
  }));
}

export async function reviewTrainerApplication(applicationId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('review_gym_trainer_application', { p_application_id: applicationId, p_approve: approve });
  if (error) throw error;
}

/** 트레이너 본인: 내 소개 (트레이너가 아니면 null) */
export async function fetchMyTrainerIntro(gymId: string, userId: string): Promise<string | null> {
  const { data } = await supabase.from('gym_staff').select('intro').eq('gym_id', gymId).eq('user_id', userId).maybeSingle();
  return data ? (data.intro ?? '') : null;
}

/** 트레이너 본인: 소개 수정 (60자) */
export async function updateMyTrainerIntro(gymId: string, intro: string): Promise<void> {
  const { error } = await supabase.rpc('update_my_trainer_intro', { p_gym_id: gymId, p_intro: intro.trim().slice(0, TRAINER_INTRO_MAX) });
  if (error) throw error;
}
