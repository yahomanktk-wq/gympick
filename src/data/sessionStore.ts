/**
 * In-memory store for workout logs created in the current app session.
 * Cleared on app restart. Used so newly logged sessions immediately appear
 * in JournalScreen without requiring a Supabase write.
 */

import type { WorkoutLog } from './types';

interface StoredSession {
  userId: string;
  log:    WorkoutLog;
}

let _sessions: StoredSession[] = [];

export function addNewSession(userId: string, log: WorkoutLog): void {
  _sessions = [{ userId, log }, ..._sessions];
}

export function getNewSessions(userId: string): WorkoutLog[] {
  return _sessions
    .filter(s => s.userId === userId)
    .map(s => s.log);
}

export function clearSessionStore(): void {
  _sessions = [];
}
