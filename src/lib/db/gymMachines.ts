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
