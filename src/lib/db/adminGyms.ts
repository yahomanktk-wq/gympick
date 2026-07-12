import { supabase } from '../supabase';
import { saveGymMachineIds } from './gymMachines';
import { invalidateGymsCache } from './gyms';

// 헬스장 관리 화면 대상 — 어드민 직접등록 + 매니저 등록 헬스장 전체
export interface AdminGym {
  id:              string;
  name:            string;
  location:        string;
  phone:           string;
  hours:           string;
  hoursNote:       string;
  machineIds:      string[];
  createdAt:       string;
  managerId:       string | null;
  managerNickname: string | null;
  managerEmail:    string | null;
}

// 전체 헬스장 목록 조회 (manager_id 유무 무관 + 보유 머신 + 연결된 매니저 정보)
export async function fetchAdminGyms(): Promise<AdminGym[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select(`
      id, name, location, phone, hours, hours_note, created_at,
      manager_id,
      gym_machines ( machine_id )
    `)
    .order('created_at', { ascending: false });

  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminGyms] fetchAdminGyms error:', error.message);
    return [];
  }

  // gyms.manager_id는 실제 FK 제약이 없는 텍스트 컬럼이라 PostgREST 임베딩이
  // 불가능 — profiles를 별도 조회해 클라이언트에서 합쳐준다.
  const managerIds = Array.from(new Set(data.map((row: any) => row.manager_id).filter(Boolean)));
  const managerMap = new Map<string, { nickname: string | null; email: string | null }>();
  if (managerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, email')
      .in('id', managerIds);
    (profiles ?? []).forEach((p: any) => managerMap.set(p.id, { nickname: p.nickname ?? null, email: p.email ?? null }));
  }

  return data.map((row: any) => {
    const manager = row.manager_id ? managerMap.get(row.manager_id) : undefined;
    return {
      id:              row.id,
      name:            row.name,
      location:        row.location,
      phone:           row.phone ?? '',
      hours:           row.hours ?? '',
      hoursNote:       row.hours_note ?? '',
      machineIds:      (row.gym_machines ?? []).map((gm: any) => gm.machine_id),
      createdAt:       row.created_at ?? '',
      managerId:       row.manager_id ?? null,
      managerNickname: manager?.nickname ?? null,
      managerEmail:    manager?.email ?? null,
    };
  });
}

// 이메일/닉네임으로 프로필 검색 (매니저 연결용)
export interface ProfileSearchResult {
  id:       string;
  email:    string | null;
  nickname: string | null;
}

export async function searchProfilesByEmailOrNickname(query: string): Promise<ProfileSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nickname')
    .or(`email.ilike.%${q}%,nickname.ilike.%${q}%`)
    .limit(20);
  if (error) {
    if (__DEV__) console.warn('[db/adminGyms] searchProfilesByEmailOrNickname error:', error.message);
    return [];
  }
  return data ?? [];
}

// 헬스장에 매니저 연결/해제 (managerId=null이면 해제)
export async function setGymManager(gymId: string, managerId: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('gyms')
    .update({ manager_id: managerId })
    .eq('id', gymId);
  if (error) return { error: error.message };
  invalidateGymsCache();
  return { error: null };
}

// 헬스장 완전 삭제 (관리용 메타데이터만 정리, 실 유저 데이터가 있으면 FK 제약으로 차단됨)
export async function deleteGym(gymId: string): Promise<{ error: string | null }> {
  // gym_machines는 ON DELETE CASCADE라 직접 지울 필요는 없지만, 명시적으로 먼저 정리
  const { error: gmError } = await supabase.from('gym_machines').delete().eq('gym_id', gymId);
  if (gmError) return { error: gmError.message };

  const { error } = await supabase.from('gyms').delete().eq('id', gymId);
  if (error) {
    // Postgres FK violation (23503) — workout_sessions 등 실 유저 데이터가 이 헬스장을
    // 참조 중이라 삭제 불가. 그런 데이터를 자동으로 같이 지우지 않고 안내만 한다.
    if (error.code === '23503') {
      return { error: '이 헬스장에는 운동기록 등 연결된 데이터가 있어 삭제할 수 없습니다.' };
    }
    return { error: error.message };
  }
  invalidateGymsCache();
  return { error: null };
}

// 직접등록 (gyms insert + 머신 저장)
export async function insertAdminGym(
  name: string, location: string, phone: string, hours: string, hoursNote: string, machineIds: string[],
): Promise<{ error: string | null }> {
  try {
    const gymId = `g_${Date.now()}`;
    const { geocodeAddress } = await import('../geocoding');
    const coords = await geocodeAddress(location.trim());

    const { error: insertError } = await supabase.from('gyms').insert({
      id:          gymId,
      name:        name.trim(),
      location:    location.trim(),
      phone:       phone.trim(),
      hours:       hours.trim(),
      hours_note:  hoursNote.trim() || null,
      description: '',
      latitude:    coords?.latitude  ?? null,
      longitude:   coords?.longitude ?? null,
      manager_id:  null,
    });
    if (insertError) return { error: insertError.message };

    // 보유 머신 저장 (gym_machines)
    const { error: machineError } = await saveGymMachineIds(gymId, machineIds);
    if (machineError) return { error: machineError };

    invalidateGymsCache();
    return { error: null };
  } catch (e: any) {
    return { error: e.message ?? '알 수 없는 오류' };
  }
}

// 직접등록 헬스장 수정 (gyms update + 머신 저장)
export async function updateAdminGymFull(
  id: string, name: string, location: string, phone: string, hours: string, hoursNote: string, machineIds: string[],
): Promise<{ error: string | null }> {
  try {
    const { geocodeAddress } = await import('../geocoding');
    const coords = await geocodeAddress(location.trim());

    const { error: updateError } = await supabase
      .from('gyms')
      .update({
        name:       name.trim(),
        location:   location.trim(),
        phone:      phone.trim(),
        hours:      hours.trim(),
        hours_note: hoursNote.trim() || null,
        latitude:   coords?.latitude  ?? null,
        longitude:  coords?.longitude ?? null,
      })
      .eq('id', id);
    if (updateError) return { error: updateError.message };

    // 보유 머신 갱신 (전체 교체)
    const { error: machineError } = await saveGymMachineIds(id, machineIds);
    if (machineError) return { error: machineError };

    invalidateGymsCache();
    return { error: null };
  } catch (e: any) {
    return { error: e.message ?? '알 수 없는 오류' };
  }
}
