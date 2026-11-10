import { supabase } from '../supabase';

// 2026-11-09: 헬스장 회원
// - QR·초대 코드로 가입하면 즉시 회원 (join_gym_by_code)
// - 앱에서 가입 신청하면 관장님 승인 후 회원 (request_gym_membership → review_gym_member_request)
// - 관장님은 회원으로 취급 (is_gym_member)
// - 초대 코드 조회/재발급, 회원·신청 목록은 관장님만 (DB 함수에서 검사)

/** staff = 그 헬스장 트레이너 (회원으로 취급하지만 회원 카드는 숨긴다) */
export type MembershipStatus = 'member' | 'staff' | 'pending' | 'none';

export interface GymMemberRow {
  userId:    string;
  /** 닉네임 (없으면 null) */
  nickname:  string | null;
  /** 짐픽 가입 때 입력한 이름 (없으면 null) */
  realName:  string | null;
  joinedVia: 'code' | 'request';
  joinedAt:  string;
}

export interface GymMemberRequestRow {
  id:        string;
  userId:    string;
  nickname:  string | null;
  realName:  string | null;
  createdAt: string;
}

export interface JoinResult {
  gymId:   string;
  gymName: string;
  already: boolean;
}

/** 내 회원 상태 (회원 / 신청 대기 / 없음) */
export async function fetchMyMembership(gymId: string, userId: string | null | undefined): Promise<MembershipStatus> {
  if (!userId) return 'none';
  const [{ data: member }, { data: staff }, { data: req }] = await Promise.all([
    supabase.from('gym_members').select('gym_id').eq('gym_id', gymId).eq('user_id', userId).maybeSingle(),
    supabase.from('gym_staff').select('gym_id').eq('gym_id', gymId).eq('user_id', userId).maybeSingle(),
    supabase.from('gym_member_requests').select('id').eq('gym_id', gymId).eq('user_id', userId).eq('status', 'pending').maybeSingle(),
  ]);
  if (staff) return 'staff';
  if (member) return 'member';
  if (req) return 'pending';
  return 'none';
}

/** 내가 회원인 헬스장 id 목록 */
export async function fetchMyGymIds(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await supabase.from('gym_members').select('gym_id').eq('user_id', userId);
  if (error) return [];
  return (data ?? []).map((r: any) => r.gym_id as string);
}

/** QR·코드로 가입. 잘못된 코드면 'invalid' */
export async function joinGymByCode(code: string): Promise<JoinResult | 'invalid'> {
  const { data, error } = await supabase.rpc('join_gym_by_code', { p_code: code });
  if (error) {
    if (error.message?.includes('invalid_code')) return 'invalid';
    throw error;
  }
  const d = data as any;
  return { gymId: d.gym_id, gymName: d.gym_name, already: !!d.already };
}

export async function requestGymMembership(gymId: string): Promise<'ok' | 'duplicate' | 'already_member'> {
  const { error } = await supabase.rpc('request_gym_membership', { p_gym_id: gymId });
  if (!error) return 'ok';
  if (error.message?.includes('already_member')) return 'already_member';
  if (error.code === '23505') return 'duplicate';
  throw error;
}

export async function cancelMyMembershipRequest(gymId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('gym_member_requests')
    .delete()
    .eq('gym_id', gymId).eq('user_id', userId).eq('status', 'pending');
  if (error) throw error;
}

/** 본인 탈퇴 또는 관장님이 내보내기 (DB 권한 규칙이 둘 다 허용) */
export async function removeGymMember(gymId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('gym_members').delete().eq('gym_id', gymId).eq('user_id', userId);
  if (error) throw error;
}

// ── 관장님 ────────────────────────────────────────────────────────────────

export async function fetchGymInviteCode(gymId: string, rotate = false): Promise<string> {
  const { data, error } = await supabase.rpc('get_gym_invite_code', { p_gym_id: gymId, p_rotate: rotate });
  if (error) throw error;
  return data as string;
}

export async function fetchGymMembers(gymId: string): Promise<GymMemberRow[]> {
  const { data, error } = await supabase.rpc('list_gym_members', { p_gym_id: gymId });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    userId: r.user_id, nickname: r.nickname ?? null, realName: r.real_name ?? null, joinedVia: r.joined_via, joinedAt: r.joined_at,
  }));
}

export async function fetchGymMemberRequests(gymId: string): Promise<GymMemberRequestRow[]> {
  const { data, error } = await supabase.rpc('list_gym_member_requests', { p_gym_id: gymId });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id, userId: r.user_id, nickname: r.nickname ?? null, realName: r.real_name ?? null, createdAt: r.created_at,
  }));
}

export async function reviewGymMemberRequest(requestId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('review_gym_member_request', { p_request_id: requestId, p_approve: approve });
  if (error) throw error;
}

/** 회원·트레이너·관장님이면 true (DB is_gym_member) — '우리 헬스장만' 공개 범위 선택 가능 여부 */
export async function checkIsGymMember(gymId: string, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.rpc('is_gym_member', { p_gym_id: gymId, p_user_id: userId });
  if (error) return false;
  return data === true;
}

/** 관장님 화면 표시용: '닉네임 (이름)' — 둘 중 있는 것만 */
export function memberDisplayName(m: { nickname: string | null; realName: string | null }): { primary: string; secondary: string | null } {
  if (m.nickname && m.realName && m.nickname !== m.realName) return { primary: m.nickname, secondary: m.realName };
  return { primary: m.nickname ?? m.realName ?? '이름 없음', secondary: null };
}

export interface MyGym {
  gymId:    string;
  gymName:  string;
  role:     'member' | 'trainer';
  joinedAt: string;
}

/** 내가 회원·트레이너인 헬스장 목록 (프로필 '내 헬스장' 대시보드) */
export async function fetchMyGyms(userId: string | null | undefined): Promise<MyGym[]> {
  if (!userId) return [];
  const [{ data: members }, { data: staff }] = await Promise.all([
    supabase.from('gym_members').select('gym_id, joined_at, gyms(name)').eq('user_id', userId),
    supabase.from('gym_staff').select('gym_id, granted_at, gyms(name)').eq('user_id', userId),
  ]);
  const map = new Map<string, MyGym>();
  (members ?? []).forEach((r: any) => map.set(r.gym_id, {
    gymId: r.gym_id, gymName: r.gyms?.name ?? '헬스장', role: 'member', joinedAt: r.joined_at,
  }));
  (staff ?? []).forEach((r: any) => map.set(r.gym_id, {
    gymId: r.gym_id, gymName: r.gyms?.name ?? '헬스장', role: 'trainer', joinedAt: r.granted_at,
  }));
  return [...map.values()].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
}
