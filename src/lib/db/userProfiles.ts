import { supabase } from '../supabase';

export interface UserProfile {
  id: string;
  nickname?: string;
  name: string;
  birthDate?: string;
  role: 'user' | 'manager' | 'admin';
  createdAt: string;
}

function rowToProfile(r: any): UserProfile {
  return {
    id:        r.id,
    nickname:  r.nickname ?? undefined,
    name:      r.name ?? '',
    birthDate: r.birth_date ?? undefined,
    role:      r.role ?? 'user',
    createdAt: r.created_at,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return rowToProfile(data);
}

export async function upsertUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'nickname' | 'name' | 'birthDate'>>,
): Promise<void> {
  await supabase.from('profiles').upsert({
    id:         userId,
    nickname:   updates.nickname,
    name:       updates.name,
    birth_date: updates.birthDate,
  });
}

export async function setManagerOnboarded(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ manager_onboarded: true })
    .eq('id', userId);
}

/** 전역 설정 '헬스장 페이지 노출 끄기' 값. 실패/없음 → false(노출) */
export async function fetchHideOunwanOnGym(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('hide_ounwan_on_gym')
      .eq('id', userId)
      .maybeSingle();
    return data?.hide_ounwan_on_gym === true;
  } catch {
    return false;
  }
}

/** 랭킹에서 내 기록 숨기기 설정 값 (F3-4). 실패/없음 → false(노출) */
export async function fetchHideFromRankings(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('hide_from_rankings')
      .eq('id', userId)
      .maybeSingle();
    return data?.hide_from_rankings === true;
  } catch {
    return false;
  }
}

/** 랭킹에서 내 기록 숨기기 설정 (모든 헬스장·머신 공통). 실패 시 throw. */
export async function setHideFromRankings(userId: string, hide: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ hide_from_rankings: hide })
    .eq('id', userId);
  if (error) throw error;
}
