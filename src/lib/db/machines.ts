import { supabase } from '../supabase';
import { Machine, MachineWithGyms, ExerciseKind } from '../../data/types';
import { MACHINES } from '../../data/machines';
import { uploadMachineImage } from '../machineImageUpload';

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
  display_name:  string | null;
  brand:         string;
  target_muscle: string;
  category:      string;
  exercise_kind: string;
  image_url:     string | null;
  line:          string | null;
};

// 모든 조회 함수가 공유하는 select 컬럼 목록 — 어드민 수정 화면이 기존 값을
// 그대로 불러와 편집하려면 display_name까지 항상 함께 조회돼야 한다.
const MACHINE_SELECT_COLUMNS = 'id, name, display_name, brand, target_muscle, category, exercise_kind, image_url, line';

function rowToMachine(row: MachineRow): Machine {
  return {
    id:           row.id,
    name:         row.name,
    displayName:  row.display_name ?? undefined,
    brand:        row.brand,
    targetMuscle: row.target_muscle,
    category:     row.category,
    exerciseKind: row.exercise_kind as ExerciseKind,
    imageUrl:     row.image_url ?? undefined,
    line:         row.line ?? undefined,
    // machines 테이블엔 별도 is_custom 컬럼이 없어서 brand로 판별한다 — 노브랜드
    // 카탈로그는 항상 brand='NONE'으로 시딩되는 규칙(src/data/customMachines.ts).
    isCustom:     row.brand === 'NONE',
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
      .select(MACHINE_SELECT_COLUMNS)
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

  // 노브랜드(NONE) 카탈로그도 다른 머신과 동일하게 Supabase machines
  // 테이블이 유일한 원본이다 — 43개 로우가 실제로 DB에 있어야 여기 노출된다
  // (src/data/customMachines.ts 내용과 동일하게 시딩되어 있어야 함, seed SQL
  // 참고). Supabase 조회가 실패했을 때만 아래 catch 없는 에러 경로에서
  // 로컬 MACHINES(=BASE_MACHINES + CUSTOM_MACHINES)로 폴백한다.
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
    .select(MACHINE_SELECT_COLUMNS)
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
    .select(MACHINE_SELECT_COLUMNS)
    .eq('id', id)
    .single();

  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/machines] fetchMachine error, using mock:', error.message);
    return MACHINES.find(m => m.id === id);
  }

  const { getMachineGymIds } = await import('./gymMachines');
  return { ...rowToMachine(data), gymIds: await getMachineGymIds(id) };
}

// --- Admin: 신규 브랜드 머신 직접 등록 (승인 절차 없음, 즉시 반영)

/** 영문/숫자만 남기고 소문자로 변환 — id 조합용. */
function slugifyIdPart(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * 브랜드+타겟부위 조합으로 다음 사용 가능한 순번을 붙인 새 머신 id를 생성한다.
 * 형식: `<브랜드slug>_<타겟부위slug>_<2자리 순번>` (예: `lifefitness_chest_01`).
 * 같은 접두사를 가진 기존 id들을 조회해 가장 큰 순번의 다음 값을 사용한다 —
 * 동시 등록으로 인한 충돌은 insertMachine()의 재시도 루프에서 한 번 더 방어한다.
 */
export async function generateMachineId(brand: string, targetMuscle: string): Promise<string> {
  const prefix     = `${slugifyIdPart(brand)}_${slugifyIdPart(targetMuscle)}`;
  const likePrefix = prefix.replace(/_/g, '\\_'); // ILIKE에서 '_'는 와일드카드라 이스케이프 필요

  const { data, error } = await supabase
    .from('machines')
    .select('id')
    .ilike('id', `${likePrefix}\\_%`);

  if (error && __DEV__) {
    console.warn('[db/machines] generateMachineId query failed:', error.message);
  }

  const seqPattern = new RegExp(`^${prefix}_(\\d+)$`);
  let maxSeq = 0;
  for (const row of data ?? []) {
    const match = row.id.match(seqPattern);
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }

  const next   = maxSeq + 1;
  const padded = next < 100 ? String(next).padStart(2, '0') : String(next);
  return `${prefix}_${padded}`;
}

export interface NewMachineInput {
  name:         string;
  /** 화면에 name 대신 우선 표시할 이름(선택). */
  displayName?: string;
  brand:        string;
  targetMuscle: string;
  category:     string;
  /** 제품 라인명(선택). 값이 있을 때만 MachineCard에 뱃지로 표시된다. */
  line?:         string;
  /** 'machine' | 'freeweight'. 생략하면 'machine'. */
  exerciseKind?: ExerciseKind;
  /**
   * 이미 800×800 흰 배경 정사각형으로 합성된 로컬 이미지 경로(선택).
   * 전달하면 생성된 id로 webp 변환·업로드까지 이 함수 안에서 처리한다
   * (파일명이 최종 id에 종속되므로 id 생성과 업로드를 한 곳에서 묶어 처리).
   */
  squareImageLocalUri?: string;
}

/**
 * 어드민이 신규 브랜드 머신을 카탈로그에 직접 등록한다 — 매니저 신청 큐와
 * 달리 승인 절차 없이 즉시 반영된다. id는 자동 생성되며, 동시 등록으로
 * id가 충돌(23505 unique_violation)하면 다음 순번으로 최대 3회까지
 * 재시도한다. 쓰기 함수라 실패 시 폴백 없이 에러를 그대로 반환한다.
 */
export async function insertMachine(
  input: NewMachineInput,
): Promise<{ id: string } | { error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = await generateMachineId(input.brand, input.targetMuscle);

    let imageUrl: string | undefined;
    if (input.squareImageLocalUri) {
      imageUrl = (await uploadMachineImage(input.squareImageLocalUri, id)) ?? undefined;
    }

    const { error } = await supabase.from('machines').insert({
      id,
      name:          input.name,
      display_name:  input.displayName?.trim() || null,
      brand:         input.brand,
      target_muscle: input.targetMuscle,
      category:      input.category,
      line:          input.line?.trim() || null,
      exercise_kind: input.exerciseKind ?? 'machine',
      image_url:     imageUrl ?? null,
    });

    if (!error) {
      invalidateMachinesCache();
      return { id };
    }

    if (error.code !== '23505') {
      return { error: error.message };
    }
    // 23505(id 충돌) — 루프를 돌며 다음 순번으로 재시도
  }

  return { error: '머신 ID 생성에 반복적으로 실패했습니다. 다시 시도해주세요.' };
}

export interface MachineUpdateInput {
  id:            string;
  name:          string;
  displayName?:  string;
  category:      string;
  line?:         string;
  exerciseKind:  ExerciseKind;
  /**
   * 새 이미지로 교체할 때만 전달한다(선택). 이미 800×800 흰 배경 정사각형으로
   * 합성된 로컬 이미지 경로 — 전달하지 않으면 기존 image_url을 그대로 둔다.
   * 파일명은 id로 고정되므로 업로드 시 upsert로 기존 파일을 덮어쓴다.
   */
  squareImageLocalUri?: string;
}

/**
 * 기존 머신 정보를 수정한다. id·brand·target_muscle은 여기서 바꾸지 않는다 —
 * id는 gym_machines/favorite_machines 등에서 참조되는 키라 브랜드나
 * 타겟부위가 바뀌어도 자동으로 재생성하지 않기로 했다(어드민 화면에서도
 * 두 필드는 잠긴 채로 표시만 된다). 실패 시 폴백 없이 에러를 그대로 반환한다.
 */
export async function updateMachine(
  input: MachineUpdateInput,
): Promise<{ ok: true } | { error: string }> {
  const patch: Record<string, unknown> = {
    name:          input.name,
    display_name:  input.displayName?.trim() || null,
    category:      input.category,
    line:          input.line?.trim() || null,
    exercise_kind: input.exerciseKind,
  };

  if (input.squareImageLocalUri) {
    const imageUrl = await uploadMachineImage(input.squareImageLocalUri, input.id, { upsert: true });
    if (!imageUrl) {
      return { error: '이미지 업로드에 실패했습니다. 다른 값은 저장되지 않았어요 — 다시 시도해주세요.' };
    }
    patch.image_url = imageUrl;
  }

  const { error } = await supabase.from('machines').update(patch).eq('id', input.id);

  if (error) {
    return { error: error.message };
  }

  invalidateMachinesCache();
  return { ok: true };
}
