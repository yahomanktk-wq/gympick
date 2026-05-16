import { supabase } from '../supabase';
import { Gym, GymWithMachines } from '../../data/types';

// ── 메모리 캐시 ──────────────────────────────────────────────
let _gymsCache:     GymWithMachines[] | null = null;
let _gymsCacheTime: number                   = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export function invalidateGymsCache() {
  _gymsCache     = null;
  _gymsCacheTime = 0;
}

export function getGymsCacheSync(): GymWithMachines[] {
  return _gymsCache ?? [];
}

// --- Row type matching the Supabase `gyms` table schema

type GymRow = {
  id:             string;
  name:           string;
  location:       string;
  address_detail: string | null;
  description:    string;
  latitude?:      number | null;
  longitude?:     number | null;
  hours?:         string | null;
  phone?:         string | null;
  website?:       string | null;
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
    hours:         row.hours    ?? null,
    phone:         row.phone    ?? null,
    website:       row.website  ?? null,
  };
}

// --- Query functions

export async function fetchGyms(): Promise<Gym[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select('id, name, location, address_detail, description, latitude, longitude, hours, phone, website')
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
    .select('id, name, location, address_detail, description, latitude, longitude, hours, phone, website')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/gyms] fetchGym error:', error.message);
    return undefined;
  }
  return rowToGym(data);
}

export async function fetchGymsWithMachines(): Promise<GymWithMachines[]> {
  // 캐시 유효하면 즉시 반환
  const now = Date.now();
  if (_gymsCache && now - _gymsCacheTime < CACHE_TTL_MS) {
    return _gymsCache;
  }

  try {
    // gyms + gym_machines를 한 번에 JOIN 조회 (N+1 → 2회 요청)
    const { data: gymsData, error: gymsError } = await supabase
      .from('gyms')
      .select(`
        id, name, location, address_detail, description,
        latitude, longitude, hours, phone, website,
        gym_machines ( machine_id )
      `)
      .order('name');

    if (gymsError || !gymsData?.length) {
      if (__DEV__ && gymsError) console.warn('[db/gyms] fetchGymsWithMachines error:', gymsError.message);
      return _gymsCache ?? [];
    }

    const { fetchMachines } = await import('./machines');
    const allMachines = await fetchMachines();

    const result: GymWithMachines[] = gymsData.map(row => {
      const machineIds: string[] = (row.gym_machines ?? []).map((gm: any) => gm.machine_id);
      return {
        id:            row.id,
        name:          row.name,
        location:      row.location,
        addressDetail: row.address_detail ?? null,
        description:   row.description,
        latitude:      row.latitude  ?? null,
        longitude:     row.longitude ?? null,
        hours:         row.hours    ?? null,
        phone:         row.phone    ?? null,
        website:       row.website  ?? null,
        machineIds,
        machines: allMachines.filter(m => machineIds.includes(m.id)),
      } as GymWithMachines;
    });

    _gymsCache     = result;
    _gymsCacheTime = Date.now();
    return result;
  } catch (e) {
    if (__DEV__) console.warn('[db/gyms] fetchGymsWithMachines error:', e);
    return _gymsCache ?? [];
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
