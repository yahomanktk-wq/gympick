export * from './types';
export { GYMS } from './gyms';
export { MACHINES } from './machines';

import { GYMS } from './gyms';
import { MACHINES } from './machines';
import { getGymMachineIds } from './gymMachines';
import { FilterChip, FilterType, GymWithMachines } from './types';

// --- Derived helpers

/** Attach full Machine objects to a Gym, with machineIds derived from the join table. */
export function getGymWithMachines(gymId: string): GymWithMachines | undefined {
  const gym = GYMS.find(g => g.id === gymId);
  if (!gym) return undefined;
  const machineIds = getGymMachineIds(gymId);
  return {
    ...gym,
    machineIds,
    machines: MACHINES.filter(m => machineIds.includes(m.id)),
  };
}

/** All gyms with their machines pre-joined - machineIds sourced from GYM_MACHINES. */
export const GYMS_WITH_MACHINES: GymWithMachines[] = GYMS.map(gym => {
  const machineIds = getGymMachineIds(gym.id);
  return {
    ...gym,
    machineIds,
    machines: MACHINES.filter(m => machineIds.includes(m.id)),
  };
});

/** Derive unique, sorted filter chips from machine data */
export function buildFilterChips(): FilterChip[] {
  const unique = (arr: string[]): string[] => [...new Set(arr)].sort();

  const machineNames  = unique(MACHINES.map(m => m.name));
  const brands        = unique(MACHINES.map(m => m.brand));
  const muscles       = unique(MACHINES.map(m => m.targetMuscle));
  const categories    = unique(MACHINES.map(m => m.category));

  return [
    ...machineNames.map(label  => ({ label, type: 'machine'  as FilterType })),
    ...brands.map(label        => ({ label, type: 'brand'    as FilterType })),
    ...muscles.map(label       => ({ label, type: 'muscle'   as FilterType })),
    ...categories.map(label    => ({ label, type: 'category' as FilterType })),
  ];
}

/** Filter gyms by free-text query and a set of active chip labels */
export function filterGyms(
  query: string,
  activeChips: Set<string>,
): GymWithMachines[] {
  let list = GYMS_WITH_MACHINES;

  if (query.trim()) {
    const q = query.toLowerCase();
    list = list.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.location.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.machines.some(m =>
        m.name.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        m.targetMuscle.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q),
      ),
    );
  }

  if (activeChips.size > 0) {
    list = list.filter(g =>
      [...activeChips].every(chip =>
        g.machines.some(
          m =>
            m.name === chip ||
            m.brand === chip ||
            m.targetMuscle === chip ||
            m.category === chip,
        ),
      ),
    );
  }

  return list;
}

// --- New normalized exports

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
