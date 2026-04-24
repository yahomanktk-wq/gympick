/**
 * In-memory store for machine favorites.
 * Pre-seeded with mock favorites (matches FAVORITE_MACHINES in machineReviews.ts).
 */

const favoriteMachineIds: string[] = [
  'arsenal_back_1',
  'hammer_strength_chest_1',
  'atlantis_leg_12',
];

export function getFavoriteMachineIds(): string[] {
  return [...favoriteMachineIds];
}

export function addFavoriteMachine(id: string): void {
  if (!favoriteMachineIds.includes(id)) favoriteMachineIds.push(id);
}

export function removeFavoriteMachine(id: string): void {
  const idx = favoriteMachineIds.indexOf(id);
  if (idx !== -1) favoriteMachineIds.splice(idx, 1);
}

export function isFavoriteMachine(id: string): boolean {
  return favoriteMachineIds.includes(id);
}
