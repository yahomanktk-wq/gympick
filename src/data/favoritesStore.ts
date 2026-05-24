const favoriteMachineIds: string[] = [];

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
