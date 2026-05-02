import { supabase } from '../supabase';
import { Gym, GymWithMachines } from '../../data/types';

// --- Row type matching the Supabase `gyms` table schema

type GymRow = {
  id:             string;
  name:           string;
  location:       string;
  address_detail: string | null;
  description:    string;
  latitude?:      number | null;
  longitude?:     number | null;
};

function rowToGym(row: GymRow): Gym {
  return {
    id:            row.id,
    name:          row.name,
    location:      row.location,
    addressDetail: row.address_detail ?? null,
    description:   row.description,
    latitude:      row.latitude  ?? null,
    longitude:     row.longitude ?? null,
  };
}

// --- Query functions

export async function fetchGyms(): Promise<Gym[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select('id, name, location, address_detail, description, latitude, longitude')
    .order('name');

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/gyms] fetchGyms error:', error.message);
    return [];
  }
  return data.map(rowToGym);
}

export async function fetchGym(id: string): Promise<Gym | undefined> {
  const { data, error } = await supabase
    .from('gyms')
    .select('id, name, location, address_detail, description, latitude, longitude')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/gyms] fetchGym error:', error.message);
    return undefined;
  }
  return rowToGym(data);
}

export async function fetchGymsWithMachines(): Promise<GymWithMachines[]> {
  try {
    const gyms = await fetchGyms();
    if (gyms.length === 0) return [];

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
  } catch (e) {
    if (__DEV__) console.warn('[db/gyms] fetchGymsWithMachines error:', e);
    return [];
  }
}

export async function fetchGymWithMachines(id: string): Promise<GymWithMachines | undefined> {
  try {
    const gym = await fetchGym(id);
    if (!gym) return undefined;

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
  } catch (e) {
    if (__DEV__) console.warn('[db/gyms] fetchGymWithMachines error:', e);
    return undefined;
  }
}
