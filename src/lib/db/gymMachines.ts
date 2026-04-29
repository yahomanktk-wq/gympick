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

/**
 * 헬스장의 머신 목록을 Supabase에 저장한다.
 * 기존 gym_machines 레코드를 삭제 후 새로 insert (upsert 방식).
 */
export async function saveGymMachineIds(gymId: string, machineIds: string[]): Promise<{ error: string | null }> {
  try {
    const { error: deleteError } = await supabase
      .from('gym_machines')
      .delete()
      .eq('gym_id', gymId);
    if (deleteError) return { error: deleteError.message };

    if (machineIds.length === 0) return { error: null };

    const rows = machineIds.map(machineId => ({
      gym_id:     gymId,
      machine_id: machineId,
      unit_count: 1,
      condition:  'good',
    }));

    const { error: insertError } = await supabase
      .from('gym_machines')
      .insert(rows);
    if (insertError) return { error: insertError.message };

    return { error: null };
  } catch (e: any) {
    return { error: e.message ?? '알 수 없는 오류' };
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
