import { supabase } from '../supabase';
import { Gym, GymWithMachines } from '../../data/types';
import { GYMS } from '../../data/gyms';
import { GYMS_WITH_MACHINES, getGymWithMachines as getMockGymWithMachines } from '../../data';

// --- Row type matching the Supabase `gyms` table schema

type GymRow = {
  id:          string;
  name:        string;
  location:    string;
  description: string;
  latitude?:   number | null;
  longitude?:  number | null;
};

function rowToGym(row: GymRow): Gym {
  return {
    id:          row.id,
    name:        row.name,
    location:    row.location,
    description: row.description,
    latitude:    row.latitude  ?? null,
    longitude:   row.longitude ?? null,
  };
}

// --- Query functions

/** Fetch all gyms. Falls back to mock data on error. */
export async function fetchGyms(): Promise<Gym[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select('id, name, location, description, latitude, longitude')
    .order('name');

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/gyms] fetchGyms error, using mock:', error.message);
    return GYMS;
  }
  return data.map(rowToGym);
}

/** Fetch a single gym by id. Falls back to mock data on error. */
export async function fetchGym(id: string): Promise<Gym | undefined> {
  const { data, error } = await supabase
    .from('gyms')
    .select('id, name, location, description, latitude, longitude')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/gyms] fetchGym error, using mock:', error.message);
    return GYMS.find(g => g.id === id);
  }
  return rowToGym(data);
}

/** Fetch all gyms with their machine rosters pre-joined. Falls back to mock. */
export async function fetchGymsWithMachines(): Promise<GymWithMachines[]> {
  // Once Supabase has data, replace this with a joined query.
  // For now, fall back to the mock derived data.
  try {
    const gyms = await fetchGyms();
    // If we got live data, attach machine lists via the join table query.
    if (gyms !== GYMS) {
      const { fetchGymMachineIds } = await import('./gymMachines');
      const { fetchMachines }      = await import('./machines');
      const [allMachines, ...gymMachineIdArrays] = await Promise.all([
        fetchMachines(),
        ...gyms.map(g => fetchGymMachineIds(g.id)),
      ]);
      return gyms.map((gym, i) => {
        const machineIds = gymMachineIdArrays[i] as string[];
        return {
          ...gym,
          machineIds,
          machines: allMachines.filter(m => machineIds.includes(m.id)),
        } as GymWithMachines;
      });
    }
  } catch {
    // fall through to mock
  }
  return GYMS_WITH_MACHINES;
}

/** Fetch a single gym with machines joined. Falls back to mock. */
export async function fetchGymWithMachines(id: string): Promise<GymWithMachines | undefined> {
  try {
    const gym = await fetchGym(id);
    if (gym) {
      const { fetchGymMachineIds } = await import('./gymMachines');
      const { fetchMachines }      = await import('./machines');
      const [machineIds, allMachines] = await Promise.all([
        fetchGymMachineIds(id),
        fetchMachines(),
      ]);
      return {
        ...gym,
        machineIds,
        machines: allMachines.filter(m => machineIds.includes(m.id)),
      } as GymWithMachines;
    }
  } catch {
    // fall through to mock
  }
  return getMockGymWithMachines(id);
}
