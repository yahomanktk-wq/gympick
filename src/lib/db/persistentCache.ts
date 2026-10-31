import * as FileSystem from 'expo-file-system/legacy';

// 2026-10-31: 머신·헬스장 목록 기기 저장 캐시.
// 앱을 켤 때마다 머신 목록(약 1.2MB)을 새로 받느라 머신 찾기·기록하기 첫 화면이
// 늦게 뜨던 것을 줄이기 위해, 마지막으로 받은 목록을 기기 파일에 저장해 두고
// 다음 실행 때 먼저 보여준 뒤 뒤에서 최신 목록으로 갱신한다.
//
// AsyncStorage 대신 파일을 쓰는 이유: Android AsyncStorage는 한 항목이 약 2MB를
// 넘으면 읽기가 실패할 수 있어, 계속 커지는 머신 목록에는 파일이 안전하다.
//
// 저장 형식이 바뀌면 CACHE_VERSION을 올린다 — 옛 형식 파일은 자동으로 무시된다.
const CACHE_VERSION = 1;

type Envelope<T> = { v: number; savedAt: number; data: T };

function pathOf(key: string): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null; // 웹 등 파일 시스템이 없는 환경
  return `${dir}gympick-cache-${key}.json`;
}

/** 저장된 캐시를 읽는다. 없거나·버전이 다르거나·깨졌으면 null. 절대 throw하지 않는다. */
export async function readPersistedCache<T>(key: string): Promise<{ data: T; savedAt: number } | null> {
  const path = pathOf(key);
  if (!path) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || parsed.v !== CACHE_VERSION || parsed.data == null) return null;
    return { data: parsed.data, savedAt: parsed.savedAt ?? 0 };
  } catch (e) {
    if (__DEV__) console.warn(`[persistentCache] read ${key} 실패 — 무시하고 삭제:`, e);
    clearPersistedCache(key);
    return null;
  }
}

/** 캐시를 저장한다. 실패해도 앱 동작에는 영향 없음(경고만). */
export async function writePersistedCache<T>(key: string, data: T): Promise<void> {
  const path = pathOf(key);
  if (!path) return;
  try {
    const envelope: Envelope<T> = { v: CACHE_VERSION, savedAt: Date.now(), data };
    await FileSystem.writeAsStringAsync(path, JSON.stringify(envelope));
  } catch (e) {
    if (__DEV__) console.warn(`[persistentCache] write ${key} 실패:`, e);
  }
}

/** 캐시 파일을 지운다(데이터 수정 직후 등). 실패해도 무시. */
export function clearPersistedCache(key: string): void {
  const path = pathOf(key);
  if (!path) return;
  FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
}
