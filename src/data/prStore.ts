/**
 * In-memory Personal Record store.
 * Records PRs detected during the current session.
 * Resets on app restart; persisting to Supabase is a future enhancement.
 */

export interface PREntry {
  exerciseId:   string;
  exerciseName: string;
  weight:       number;
  reps:         number;
  date:         string;   // ISO 8601
}

// Map: exerciseId → sorted descending by date
const _prs: Record<string, PREntry[]> = {};

export function recordPR(entry: PREntry): void {
  if (!_prs[entry.exerciseId]) _prs[entry.exerciseId] = [];
  _prs[entry.exerciseId].unshift(entry);
}

export function getPRHistory(exerciseId: string): PREntry[] {
  return _prs[exerciseId] ?? [];
}

/** All newly recorded PRs, newest first. */
export function getAllNewPRs(): PREntry[] {
  return Object.values(_prs)
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getLatestPR(exerciseId: string): PREntry | null {
  return _prs[exerciseId]?.[0] ?? null;
}
