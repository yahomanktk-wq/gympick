import { supabase } from '../supabase';
import { Gym, GymWithMachines } from '../../data/types';
import {
  validateGymSlug, GYM_SLUG_FORMAT_MESSAGE, GYM_SLUG_RESERVED_MESSAGE, GYM_SLUG_TAKEN_MESSAGE,
} from '../gymSlug';
import { readPersistedCache, writePersistedCache, clearPersistedCache } from './persistentCache';

// ── 메모리 캐시 ──────────────────────────────────────────────
let _gymsCache:     GymWithMachines[] | null = null;
let _gymsCacheTime: number                   = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

// ── 기기 저장 캐시 (2026-10-31) ──────────────────────────────
// 머신 객체까지 저장하면 같은 머신이 헬스장마다 중복 저장돼 파일이 커지므로,
// 헬스장 정보 + 보유 머신 id만 저장하고 머신 객체는 머신 캐시에서 다시 붙인다.
type GymCacheRow = Omit<GymWithMachines, 'machines'>;
const PERSIST_KEY = 'gyms';
let _skipPersisted = false;
let _gymsInFlight: Promise<GymWithMachines[] | null> | null = null;
let _gymsGeneration = 0;

export function invalidateGymsCache() {
  _gymsCache     = null;
  _gymsCacheTime = 0;
  _skipPersisted = true;
  _gymsGeneration += 1;
  _gymsInFlight  = null;
  clearPersistedCache(PERSIST_KEY);
}

/**
 * 헬스장 행에 머신 객체를 붙인다.
 * 기존과 같은 순서(전체 머신 목록 순서)를 유지하면서, 배열 includes 대신
 * Set으로 찾아 헬스장 수 × 머신 수 × 보유 머신 수만큼 돌던 비교를 줄인다.
 */
function attachMachines(rows: GymCacheRow[], allMachines: { id: string }[]): GymWithMachines[] {
  return rows.map(row => {
    const owned = new Set(row.machineIds ?? []);
    return {
      ...row,
      machines: owned.size ? allMachines.filter(m => owned.has(m.id)) : [],
    };
  }) as GymWithMachines[];
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
    // 2026-11-09: manager_id 포함 — 빠져 있어서 헬스장 상세에서 관장님 여부(회원 카드·관리 줄·직접 관리 배지)를 알 수 없었다
    .select('id, name, location, address_detail, description, latitude, longitude, hours, hours_note, phone, website, manager_id, slug, short_code')
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

  // 앱 첫 호출(메모리 비어 있음): 기기에 저장된 목록을 먼저 돌려주고 뒤에서 갱신
  if (!_gymsCache && !_skipPersisted) {
    const persisted = await readPersistedCache<GymCacheRow[]>(PERSIST_KEY);
    if (persisted?.data?.length && !_gymsCache && !_skipPersisted) {
      const { fetchMachines } = await import('./machines');
      const allMachines = await fetchMachines(); // 머신도 기기 캐시에서 바로 나옴
      const result = attachMachines(persisted.data, allMachines);
      _gymsCache     = result;
      _gymsCacheTime = Date.now();
      loadGymsFromNetwork(); // 기다리지 않음
      return result;
    }
  }

  const fresh = await loadGymsFromNetwork();
  if (fresh) return fresh;
  return _gymsCache ?? [];
}

/** 서버에서 헬스장 목록을 받아 메모리·기기 캐시를 갱신한다. 실패하면 null. 동시 호출은 하나로 합친다. */
function loadGymsFromNetwork(): Promise<GymWithMachines[] | null> {
  if (_gymsInFlight) return _gymsInFlight;
  const gen = _gymsGeneration;
  const p: Promise<GymWithMachines[] | null> = fetchGymsFromServer(gen)
    .catch(e => {
      if (__DEV__) console.warn('[db/gyms] fetchGymsWithMachines error:', e);
      return null;
    })
    .finally(() => { if (_gymsInFlight === p) _gymsInFlight = null; });
  _gymsInFlight = p;
  return p;
}

async function fetchGymsFromServer(gen: number): Promise<GymWithMachines[] | null> {
  const { fetchMachines } = await import('./machines');

  // gyms(+gym_machines, 오피셜 브랜드)와 머신 목록은 서로 독립이라 동시에 요청한다
  const [gymsRes, allMachines] = await Promise.all([
    supabase
      .from('gyms')
      .select(`
        id, name, location, address_detail, description,
        latitude, longitude, hours, hours_note, phone, website,
        manager_id, slug, short_code,
        gym_machines ( machine_id ),
        gym_official_brands ( brand )
      `)
      .order('name'),
    fetchMachines(),
  ]);
  const { data: gymsData, error: gymsError } = gymsRes;

  if (gymsError || !gymsData?.length) {
    if (__DEV__ && gymsError) console.warn('[db/gyms] fetchGymsWithMachines error:', gymsError.message);
    return null;
  }

  const rows: GymCacheRow[] = gymsData.map((row: any) => ({
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
    machineIds:     (row.gym_machines ?? []).map((gm: any) => gm.machine_id),
  } as GymCacheRow));

  const result = attachMachines(rows, allMachines);

  // 요청 도중 invalidate됐다면 옛 데이터일 수 있어 캐시에 넣지 않는다
  if (gen !== _gymsGeneration) return result;

  _gymsCache     = result;
  _gymsCacheTime = Date.now();
  _skipPersisted = false;
  writePersistedCache(PERSIST_KEY, rows); // 기다리지 않음
  return result;
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
