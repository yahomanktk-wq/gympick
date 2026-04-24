// In-memory gym favorites store — pre-seeded with 3 gyms for mock user u1

const _favorites = new Set<string>(['g01', 'g04', 'g05']);

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

/** Toggles and returns the new state (true = now favorited). */
export function toggleGymFavorite(gymId: string): boolean {
  if (_favorites.has(gymId)) {
    _favorites.delete(gymId);
    return false;
  }
  _favorites.add(gymId);
  return true;
}
