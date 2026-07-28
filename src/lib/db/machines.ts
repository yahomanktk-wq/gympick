import { supabase } from '../supabase';
import { Machine, MachineWithGyms, ExerciseKind } from '../../data/types';
import { MACHINES } from '../../data/machines';

// ── 메모리 캐시 ──────────────────────────────────────────────
let _machinesCache:     MachineWithGyms[] | null = null;
let _machinesCacheTime: number                   = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export function invalidateMachinesCache() {
  _machinesCache     = null;
  _machinesCacheTime = 0;
}

export function getMachinesCacheSync(): MachineWithGyms[] {
  return _machinesCache ?? [];
}

// --- Row type matching the Supabase `machines` table schema

type MachineRow = {
  id:            string;
  name:          string;
  brand:         string;
  target_muscle: string;
  category:      string;
  exercise_kind: string;
  image_url:     string | null;
  line:          string | null;
};

function rowToMachine(row: MachineRow): Machine {
  return {
    id:           row.id,
    name:         row.name,
    brand:        row.brand,
    targetMuscle: row.target_muscle,
    category:     row.category,
    exerciseKind: row.exercise_kind as ExerciseKind,
    imageUrl:     row.image_url ?? undefined,
    line:         row.line ?? undefined,
  };
}

// --- Query functions

/** Fetch all machines. Falls back to mock data on error. */
export async function fetchMachines(): Promise<MachineWithGyms[]> {
  // 캐시 유효하면 즉시 반환
  const now = Date.now();
  if (_machinesCache && now - _machinesCacheTime < CACHE_TTL_MS) {
    return _machinesCache;
  }

  // 머신 목록과 gym_machines를 동시에 한 번에 가져옴 (N+1 쿼리 방지)
  const [machinesResult, gymMachinesResult] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, brand, target_muscle, category, exercise_kind, image_url, line')
      .order('name')
      .range(0, 2999),
    supabase
      .from('gym_machines')
      .select('machine_id, gym_id'),
  ]);

  if (machinesResult.error || !machinesResult.data?.length) {
    if (__DEV__ && machinesResult.error) console.warn('[db/machines] fetchMachines error, using mock:', machinesResult.error.message);
    return _machinesCache ?? MACHINES;
  }

  // gym_machines를 machineId 기준으로 인메모리 맵핑
  const gymMap = new Map<string, string[]>();
  for (const row of (gymMachinesResult.data ?? [])) {
    const existing = gymMap.get(row.machine_id) ?? [];
    existing.push(row.gym_id);
    gymMap.set(row.machine_id, existing);
  }

  const result = machinesResult.data.map(row => ({
    ...rowToMachine(row),
    gymIds: gymMap.get(row.id) ?? [],
  }));

  _machinesCache     = result;
  _machinesCacheTime = Date.now();
  return result;
}

/** Free Weight 머신만 조회. Falls back to local FREE_WEIGHTS on error. */
export async function fetchFreeWeights(): Promise<MachineWithGyms[]> {
  const { data, error } = await supabase
    .from('machines')
    .select('id, name, brand, target_muscle, category, exercise_kind, image_url, line')
    .eq('exercise_kind', 'freeweight')
    .order('target_muscle');

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/machines] fetchFreeWeights error, using local:', error.message);
    const { FREE_WEIGHTS } = await import('../../data/freeWeights');
    return FREE_WEIGHTS.map(fw => ({
      id:           fw.id,
      name:         fw.name,
      brand:        fw.brand,
      targetMuscle: fw.targetMuscle,
      category:     'Free Weight',
      exerciseKind: 'freeweight' as const,
      gymIds:       [],
    }));
  }

  return data.map(row => ({
    ...rowToMachine(row),
    gymIds: [],
  }));
}

/** Fetch a single machine by id. Falls back to mock data on error. */
export async function fetchMachine(id: string): Promise<MachineWithGyms | undefined> {
  const { data, error } = await supabase
    .from('machines')
    .select('id, name, brand, target_muscle, category, exercise_kind, image_url, line')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/machines] fetchMachine error, using mock:', error.message);
    return MACHINES.find(m => m.id === id);
  }

  const { getMachineGymIds } = await import('./gymMachines');
  return { ...rowToMachine(data), gymIds: await getMachineGymIds(id) };
}
