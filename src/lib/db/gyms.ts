import { supabase } from '../supabase';
import { Gym, GymWithMachines } from '../../data/types';
import {
  validateGymSlug, GYM_SLUG_FORMAT_MESSAGE, GYM_SLUG_RESERVED_MESSAGE, GYM_SLUG_TAKEN_MESSAGE,
} from '../gymSlug';

// ── 메모리 캐시 ──────────────────────────────────────────────
let _gymsCache:     GymWithMachines[] | null = null;
let _gymsCacheTime: number                   = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

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
  hours_note?:    string | null;
  phone?:         string | null;
  website?:       string | null;
  manager_id?:    string | null;
  slug?:          string | null;
  short_code?:    string | null;
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
    hours:         row.hours      ?? null,
    hoursNote:     row.hours_note ?? null,
    phone:         row.phone      ?? null,
    website:       row.website    ?? null,
    managerId:     row.manager_id ?? null,
    slug:          row.slug       ?? null,
    short_code:    row.short_code ?? null,
  };
}

// --- Query functions

export async function fetchGyms(): Promise<Gym[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select('id, name, location, address_detail, description, latitude, longitude, hours, hours_note, phone, website, manager_id, slug, short_code')
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
    .select('id, name, location, address_detail, description, latitude, longitude, hours, hours_note, phone, website, slug, short_code')
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
        latitude, longitude, hours, hours_note, phone, website,
        manager_id, slug, short_code,
        gym_machines ( machine_id ),
        gym_official_brands ( brand )
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
        hours:         row.hours      ?? null,
        hoursNote:     row.hours_note ?? null,
        phone:         row.phone      ?? null,
        website:       row.website    ?? null,
        managerId:      row.manager_id ?? null,
        slug:           row.slug       ?? null,
        short_code:     row.short_code ?? null,
        officialBrands: (row.gym_official_brands ?? []).map((ob: any) => ob.brand),
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
    const { fetchGymOfficialBrands } = await import('./gymOfficialBrands');
    const [machineIds, allMachines, officialBrands] = await Promise.all([
      fetchGymMachineIds(id),
      fetchMachines(),
      fetchGymOfficialBrands(id),
    ]);
    return {
      ...gym,
      machineIds,
      machines:       allMachines.filter(m => machineIds.includes(m.id)),
      officialBrands,
    } as GymWithMachines;
  } catch (e) {
    if (__DEV__) console.warn('[db/gyms] fetchGymWithMachines error:', e);
    return undefined;
  }
}

// --- 영어 이름(slug) — 검증 규칙은 src/lib/gymSlug.ts

/** 다른 헬스장이 이 slug를 쓰고 있지 않으면 true. 조회 실패 시 throw. */
export async function checkGymSlugAvailable(slug: string, currentGymId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('gyms')
    .select('id')
    .eq('slug', slug)
    .neq('id', currentGymId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length === 0;
}

export type UpdateGymSlugResult =
  | { ok: true }
  | { ok: false; reason: 'taken' | 'invalid' | 'error'; message: string };

/** slug 저장 (null이면 해제). DB 제약(unique 23505 / check 23514)이 최종 판정. */
export async function updateGymSlug(gymId: string, slug: string | null): Promise<UpdateGymSlugResult> {
  const { data, error } = await supabase
    .from('gyms')
    .update({ slug })
    .eq('id', gymId)
    .select('id');

  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'taken', message: GYM_SLUG_TAKEN_MESSAGE };
    if (error.code === '23514') {
      const reserved = slug ? validateGymSlug(slug) === 'reserved' || error.message.includes('reserved') : false;
      return { ok: false, reason: 'invalid', message: reserved ? GYM_SLUG_RESERVED_MESSAGE : GYM_SLUG_FORMAT_MESSAGE };
    }
    if (__DEV__) console.warn('[db/gyms] updateGymSlug error:', error.message);
    return { ok: false, reason: 'error', message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
  // RLS로 막히면 에러 없이 0행이 반환된다
  if (!data?.length) {
    return { ok: false, reason: 'error', message: '이 헬스장을 수정할 권한이 없어요.' };
  }
  invalidateGymsCache();
  return { ok: true };
}
