// 머신 즐겨찾기 — 로컬 캐시 (Supabase와 동기화)
//
// 2026-09-09: 기존엔 이 파일이 순수 메모리 배열만 갖고 있어서 앱을 재시작하면
// 즐겨찾기가 전부 사라졌음(favorite_machines 테이블에 저장하는 코드가 아예 없었음).
// gymFavoriteStore.ts와 동일한 "로컬 캐시 + initFavoriteMachines(서버값)" 패턴으로 변경.
// 실제 Supabase 읽기/쓰기는 src/lib/db/machineFavorites.ts, 호출(로그인 시 초기화 등)은
// src/context/AuthContext.tsx 참고.

const _favorites = new Set<string>();

/** Supabase에서 불러온 즐겨찾기 목록으로 로컬 캐시를 초기화한다 */
export function initFavoriteMachines(machineIds: string[]): void {
  _favorites.clear();
  machineIds.forEach(id => _favorites.add(id));
}

export function getFavoriteMachineIds(): string[] {
  return [..._favorites];
}

export function addFavoriteMachine(id: string): void {
  _favorites.add(id);
}

export function removeFavoriteMachine(id: string): void {
  _favorites.delete(id);
}

export function isFavoriteMachine(id: string): boolean {
  return _favorites.has(id);
}
