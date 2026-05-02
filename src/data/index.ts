export * from './types';
export { GYMS } from './gyms';
export { MACHINES } from './machines';

import { MACHINES } from './machines';
import { FilterChip, FilterType, GymWithMachines } from './types';

// Mock 제거 — Supabase에서 fetch하여 사용
export const GYMS_WITH_MACHINES: GymWithMachines[] = [];

export async function getGymWithMachines(gymId: string): Promise<GymWithMachines | undefined> {
  try {
    const { fetchGymWithMachines } = await import('../lib/db/gyms');
    return await fetchGymWithMachines(gymId);
  } catch {
    return undefined;
  }
}

export function filterGyms(
  _query: string,
  _activeChips: Set<string>,
): GymWithMachines[] {
  return [];
}

export function buildFilterChips(): FilterChip[] {
  const unique = (arr: string[]): string[] => [...new Set(arr)].sort();
  const machineNames = unique(MACHINES.map(m => m.name));
  const brands       = unique(MACHINES.map(m => m.brand));
  const muscles      = unique(MACHINES.map(m => m.targetMuscle));
  const categories   = unique(MACHINES.map(m => m.category));
  return [
    ...machineNames.map(label => ({ label, type: 'machine'  as FilterType })),
    ...brands.map(label       => ({ label, type: 'brand'    as FilterType })),
    ...muscles.map(label      => ({ label, type: 'muscle'   as FilterType })),
    ...categories.map(label   => ({ label, type: 'category' as FilterType })),
  ];
}

export {
  GYM_MACHINES,
  getGymMachineIds,
  getMachineGymIds,
  getGymMachineLinks,
} from './gymMachines';

export {
  MACHINE_REVIEWS,
  FAVORITE_MACHINES,
  getMachineReviews,
  getUserFavorites,
  isUserFavorite,
} from './machineReviews';

export {
  RAW_WORKOUT_SESSIONS,
  WORKOUT_ENTRIES,
  WORKOUT_SETS,
  WORKOUT_PHOTOS,
  getMachinePRsFromSets,
  getSessionPRMachinesFromSets,
} from './workoutSessions';
