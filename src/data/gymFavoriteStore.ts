// 헬스장 즐겨찾기 — 로컬 캐시 (Supabase와 동기화)

const _favorites = new Set<string>();

/** Supabase에서 불러온 즐겨찾기 목록으로 로컬 캐시를 초기화한다 */
export function initGymFavorites(gymIds: string[]): void {
  _favorites.clear();
  gymIds.forEach(id => _favorites.add(id));
}

export function getGymFavorites(): string[] {
  return [..._favorites];
}

export function addGymFavorite(gymId: string): void {
  _favorites.add(gymId);
}

export function removeGymFavorite(gymId: string): void {
  _favorites.delete(gymId);
}

export function isGymFavorite(gymId: string): boolean {
  return _favorites.has(gymId);
}

/** 로컬 토글 후 새 상태(true=즐겨찾기됨)를 반환한다. DB 호출은 호출부에서 처리. */
export function toggleGymFavorite(gymId: string): boolean {
  if (_favorites.has(gymId)) {
    _favorites.delete(gymId);
    return false;
  }
  _favorites.add(gymId);
  return true;
}
