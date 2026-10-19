import { supabase } from '../supabase';
import { GymMachineLink, MachineCondition } from '../../data/types';
import {
  GYM_MACHINES,
  getGymMachineIds  as mockGetGymMachineIds,
  getMachineGymIds  as mockGetMachineGymIds,
  getGymMachineLinks as mockGetGymMachineLinks,
} from '../../data/gymMachines';

// --- Row type matching the Supabase `gym_machines` table schema

type GymMachineRow = {
  gym_id:     string;
  machine_id: string;
  unit_count: number;
  condition:  string;
};

function rowToLink(row: GymMachineRow): GymMachineLink {
  return {
    gymId:     row.gym_id,
    machineId: row.machine_id,
    unitCount: row.unit_count,
    condition: row.condition as MachineCondition,
  };
}

// --- Query functions

/** Fetch all gym-machine links. Falls back to mock data on error. */
export async function fetchGymMachines(): Promise<GymMachineLink[]> {
  const { data, error } = await supabase
    .from('gym_machines')
    .select('gym_id, machine_id, unit_count, condition');

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/gymMachines] fetchGymMachines error, using mock:', error.message);
    return GYM_MACHINES;
  }
  return data.map(rowToLink);
}

/** Returns all machineIds available at a given gym. Falls back to mock. */
export async function fetchGymMachineIds(gymId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('gym_machines')
    .select('machine_id')
    .eq('gym_id', gymId);

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/gymMachines] fetchGymMachineIds error, using mock:', error.message);
    return mockGetGymMachineIds(gymId);
  }
  return data.map((r: { machine_id: string }) => r.machine_id);
}

/** Returns all gymIds that carry a given machine. Falls back to mock. */
export async function getMachineGymIds(machineId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('gym_machines')
    .select('gym_id')
    .eq('machine_id', machineId);

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/gymMachines] getMachineGymIds error, using mock:', error.message);
    return mockGetMachineGymIds(machineId);
  }
  return data.map((r: { gym_id: string }) => r.gym_id);
}

const MACHINE_ID_CHUNK = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * 헬스장의 보유 머신 목록을 Supabase에 저장한다 — 변경분(diff)만 반영.
 * 2026-10-19 (F4-1): 예전엔 전체 삭제 후 전체 재삽입이라 저장할 때마다 모든 행의
 * created_at이 초기화되고, insert 트리거가 모든 머신에 대해 다시 실행됐다.
 * 이제 현재 DB 목록과 비교해 추가된 머신만 insert, 빠진 머신만 delete하고
 * 나머지 행은 건드리지 않는다(created_at 보존).
 *
 * notify(새 머신 입고 알림, F4-2 트리거용) = 다음을 모두 만족할 때만 true:
 *   - 이번 저장에서 새로 추가된 행
 *   - options.notifyNewMachines === true (매니저 '머신 관리' 화면에서 저장)
 *   - 저장 전에 이미 1대 이상 보유 중이던 헬스장 (첫 일괄 등록은 알림 X)
 * 관리자 저장(adminGyms.ts)은 옵션 없이 호출하므로 항상 notify=false.
 *
 * 부분 실패: 삭제 성공 후 추가가 실패하면 error를 돌려준다(화면에 '저장 실패' 표시).
 * diff 방식이라 다시 저장하면 남은 차이만 반영되어 결국 원하는 상태로 수렴한다.
 * 현재 목록 조회에 실패하면 아무것도 쓰지 않는다(mock 폴백 없음).
 */
export async function saveGymMachineIds(
  gymId: string,
  machineIds: string[],
  options: { notifyNewMachines?: boolean } = {},
): Promise<{ error: string | null; added: string[]; removed: string[] }> {
  try {
    // 1. 현재 보유 목록
    const { data: currentRows, error: readError } = await supabase
      .from('gym_machines')
      .select('machine_id')
      .eq('gym_id', gymId);
    if (readError) return { error: readError.message, added: [], removed: [] };

    const current  = new Set((currentRows ?? []).map((r: { machine_id: string }) => r.machine_id));
    // 2. diff
    const input    = Array.from(new Set(machineIds));
    const inputSet = new Set(input);
    const toAdd    = input.filter(id => !current.has(id));
    const toRemove = Array.from(current).filter(id => !inputSet.has(id));

    // 3. 빠진 머신 삭제
    for (const ids of chunk(toRemove, MACHINE_ID_CHUNK)) {
      const { error: deleteError } = await supabase
        .from('gym_machines')
        .delete()
        .eq('gym_id', gymId)
        .in('machine_id', ids);
      if (deleteError) return { error: deleteError.message, added: [], removed: [] };
    }

    // 4. 추가된 머신 insert
    const notify = options.notifyNewMachines === true && current.size > 0;
    for (const ids of chunk(toAdd, MACHINE_ID_CHUNK)) {
      const rows = ids.map(machineId => ({
        gym_id:     gymId,
        machine_id: machineId,
        unit_count: 1,
        condition:  'good',
        notify,
      }));
      const { error: insertError } = await supabase
        .from('gym_machines')
        .insert(rows);
      if (insertError) return { error: insertError.message, added: [], removed: toRemove };
    }

    return { error: null, added: toAdd, removed: toRemove };
  } catch (e: any) {
    return { error: e.message ?? '알 수 없는 오류', added: [], removed: [] };
  }
}

/** Returns full link rows for a gym (inventory view). Falls back to mock. */
export async function fetchGymMachineLinks(gymId: string): Promise<GymMachineLink[]> {
  const { data, error } = await supabase
    .from('gym_machines')
    .select('gym_id, machine_id, unit_count, condition')
    .eq('gym_id', gymId);

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/gymMachines] fetchGymMachineLinks error, using mock:', error.message);
    return mockGetGymMachineLinks(gymId);
  }
  return data.map(rowToLink);
}
