import { supabase } from '../supabase';
import { track } from '../analytics';
import type {
  WorkoutSession,
  WorkoutEntry,
  WorkoutSet,
  WorkoutPhoto,
  WorkoutLog,
  LoggedMachineEntry,
  ExerciseKind,
  PhotoAspectRatio,
} from '../../data/types';
import {
  RAW_WORKOUT_SESSIONS,
  WORKOUT_ENTRIES,
  WORKOUT_SETS,
  WORKOUT_PHOTOS,
} from '../../data/workoutSessions';
import { getNewSessions } from '../../data/sessionStore';

// --- Row types matching the actual Supabase table schemas
// Notes on deviations from the TypeScript interfaces:
//   workout_entries.sort_order  - "order" is a reserved SQL keyword
//   workout_entries.exercise_kind - may not exist; defaulted to 'machine' when absent
//   workout_photos  - only core columns selected; extras treated as optional

type SessionRow = {
  id:                 string;
  user_id:            string;
  gym_id:             string;
  date:               string;
  body_weight:        number | null;
  notes:              string | null;
  overlay_text_color: string | null;
  target_muscles:     string[] | null;
};

type EntryRow = {
  id:            string;
  session_id:    string;
  machine_id:    string;
  machine_name:  string;
  machine_brand: string;
  target_muscle: string;
  sort_order:    number;
  exercise_kind?: string | null;  // column may not exist in all schemas
};

type SetRow = {
  id:         string;
  entry_id:   string;
  set_number: number;
  weight:     number;
  reps:       number;
  is_pr:      boolean | null;
};

type PhotoRow = {
  id:             string;
  session_id:     string;
  user_id:        string;
  captured_at:    string;
  text_color:     string;
  aspect_ratio?:  string | null;
  composite_uri?: string | null;
  photo_uri?:     string | null;
  thumbnail_uri?: string | null;
};

// --- Row converters

function rowToSession(r: SessionRow): WorkoutSession {
  return {
    id:               r.id,
    userId:           r.user_id,
    gymId:            r.gym_id,
    date:             r.date,
    bodyWeight:       r.body_weight ?? undefined,
    notes:            r.notes ?? undefined,
    overlayTextColor: r.overlay_text_color ?? undefined,
    targetMuscles:    r.target_muscles ?? undefined,
  };
}

function rowToEntry(r: EntryRow): WorkoutEntry {
  return {
    id:           r.id,
    sessionId:    r.session_id,
    machineId:    r.machine_id,
    machineName:  r.machine_name,
    machineBrand: r.machine_brand,
    targetMuscle: r.target_muscle,
    exerciseKind: (r.exercise_kind ?? 'machine') as ExerciseKind,
    order:        r.sort_order,
  };
}

function rowToSet(r: SetRow): WorkoutSet {
  return {
    id:        r.id,
    entryId:   r.entry_id,
    setNumber: r.set_number,
    weight:    r.weight,
    reps:      r.reps,
    isPR:      r.is_pr ?? undefined,
  };
}

function rowToPhoto(r: PhotoRow): WorkoutPhoto {
  return {
    id:           r.id,
    sessionId:    r.session_id,
    userId:       r.user_id,
    capturedAt:   r.captured_at,
    textColor:    r.text_color,
    aspectRatio:  (r.aspect_ratio as PhotoAspectRatio) ?? undefined,
    compositeUri: r.composite_uri ?? undefined,
    photoUri:     r.photo_uri ?? undefined,
    thumbnailUri: r.thumbnail_uri ?? undefined,
  };
}

// --- workout_sessions

/** Fetch all workout sessions for a user. Falls back to mock data on error. */
export async function fetchWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, user_id, gym_id, date, body_weight, notes, overlay_text_color, target_muscles')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchWorkoutSessions, using mock:', error.message);
    return RAW_WORKOUT_SESSIONS.filter(s => s.userId === userId);
  }
  return data.map(rowToSession);
}

/** Fetch a single workout session by id. Falls back to mock. */
export async function fetchWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, user_id, gym_id, date, body_weight, notes, overlay_text_color, target_muscles')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchWorkoutSession, using mock:', error.message);
    return RAW_WORKOUT_SESSIONS.find(s => s.id === id);
  }
  return rowToSession(data);
}

// --- workout_entries

/** Fetch all entries for a session, ordered by sort_order. Falls back to mock. */
export async function fetchWorkoutEntries(sessionId: string): Promise<WorkoutEntry[]> {
  const { data, error } = await supabase
    .from('workout_entries')
    .select('id, session_id, machine_id, machine_name, machine_brand, target_muscle, sort_order')
    .eq('session_id', sessionId)
    .order('sort_order');

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchWorkoutEntries, using mock:', error.message);
    return WORKOUT_ENTRIES.filter(e => e.sessionId === sessionId);
  }
  return data.map(rowToEntry);
}

// --- workout_sets

/** Fetch all sets for an entry. Falls back to mock. */
export async function fetchWorkoutSets(entryId: string): Promise<WorkoutSet[]> {
  const { data, error } = await supabase
    .from('workout_sets')
    .select('id, entry_id, set_number, weight, reps, is_pr')
    .eq('entry_id', entryId)
    .order('set_number');

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchWorkoutSets, using mock:', error.message);
    return WORKOUT_SETS.filter(s => s.entryId === entryId);
  }
  return data.map(rowToSet);
}

/** Fetch all sets for a list of entry ids in one query. Falls back to mock. */
export async function fetchWorkoutSetsForEntries(entryIds: string[]): Promise<WorkoutSet[]> {
  if (!entryIds.length) return [];
  const { data, error } = await supabase
    .from('workout_sets')
    .select('id, entry_id, set_number, weight, reps, is_pr')
    .in('entry_id', entryIds)
    .order('set_number');

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchWorkoutSetsForEntries, using mock:', error.message);
    return WORKOUT_SETS.filter(s => entryIds.includes(s.entryId));
  }
  return data.map(rowToSet);
}

/** Fetch entries for multiple sessions in one query. Falls back to mock. */
export async function fetchWorkoutEntriesForSessions(sessionIds: string[]): Promise<WorkoutEntry[]> {
  if (!sessionIds.length) return [];
  const { data, error } = await supabase
    .from('workout_entries')
    .select('id, session_id, machine_id, machine_name, machine_brand, target_muscle, sort_order')
    .in('session_id', sessionIds)
    .order('sort_order');

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchWorkoutEntriesForSessions, using mock:', error.message);
    return WORKOUT_ENTRIES.filter(e => sessionIds.includes(e.sessionId));
  }
  return data.map(rowToEntry);
}

/** Fetch which session ids have at least one photo. Falls back to mock. */
export async function fetchSessionsWithPhotos(sessionIds: string[]): Promise<Set<string>> {
  if (!sessionIds.length) return new Set();
  const { data, error } = await supabase
    .from('workout_photos')
    .select('session_id')
    .in('session_id', sessionIds);

  if (error) {
    if (__DEV__) console.warn('[db/workouts] fetchSessionsWithPhotos, using mock:', error.message);
    return new Set(
      WORKOUT_PHOTOS
        .filter(p => sessionIds.includes(p.sessionId))
        .map(p => p.sessionId),
    );
  }
  return new Set(
    (data ?? []).map((p: { session_id: string }) => p.session_id),
  );
}

/** Fetch photos for a list of session ids. Returns map of sessionId → WorkoutPhoto */
export async function fetchPhotosForSessions(
  sessionIds: string[],
): Promise<Map<string, WorkoutPhoto>> {
  if (!sessionIds.length) return new Map();

  const { data, error } = await supabase
    .from('workout_photos')
    .select('id, session_id, user_id, captured_at, text_color, aspect_ratio, composite_uri, photo_uri, thumbnail_uri')
    .in('session_id', sessionIds);

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchPhotosForSessions error:', error.message);
    return new Map();
  }

  const map = new Map<string, WorkoutPhoto>();
  for (const row of data) {
    map.set(row.session_id, rowToPhoto(row));
  }
  return map;
}

// --- workout_photos

/** Fetch photos for a session. Falls back to mock. */
export async function fetchWorkoutPhotos(sessionId: string): Promise<WorkoutPhoto[]> {
  const { data, error } = await supabase
    .from('workout_photos')
    .select('id, session_id, user_id, captured_at, text_color, aspect_ratio, thumbnail_uri')
    .eq('session_id', sessionId);

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchWorkoutPhotos, using mock:', error.message);
    return WORKOUT_PHOTOS.filter(p => p.sessionId === sessionId);
  }
  return data.map(rowToPhoto);
}

/** Fetch all photos for a user. Falls back to mock. */
export async function fetchUserPhotos(userId: string): Promise<WorkoutPhoto[]> {
  const { data, error } = await supabase
    .from('workout_photos')
    .select('id, session_id, user_id, captured_at, text_color, aspect_ratio, thumbnail_uri')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false });

  if (error || !data?.length) {
    if (__DEV__ && error) console.warn('[db/workouts] fetchUserPhotos, using mock:', error.message);
    return WORKOUT_PHOTOS.filter(p => p.userId === userId);
  }
  return data.map(rowToPhoto);
}

// --- WorkoutLog view (joined read model)

/**
 * Fetch fully-joined WorkoutLog objects for a user.
 *
 * Uses the individual fetch helpers so each table has its own mock fallback:
 *   fetchWorkoutSessions  → workout_sessions
 *   fetchWorkoutEntriesForSessions → workout_entries (batch)
 *   fetchWorkoutSetsForEntries     → workout_sets    (batch)
 *   fetchSessionsWithPhotos        → workout_photos  (batch existence check)
 *
 * If fetchWorkoutSessions returns the mock dataset (detected by session IDs),
 * the pre-built MOCK_SESSIONS view is returned directly to avoid an unnecessary
 * reassembly pass.
 */
export async function fetchWorkoutLogs(userId: string): Promise<WorkoutLog[]> {
  try {
    // 1. Sessions - fetchWorkoutSessions owns the mock fallback
    const sessions = await fetchWorkoutSessions(userId);

    // If every session ID belongs to the mock dataset, skip reassembly and
    // return MOCK_SESSIONS (which already has gym names, machines, and photos).
    if (sessions.length === 0) return getNewSessions(userId);

    const sessionIds = sessions.map(s => s.id);
    const gymIds     = [...new Set(sessions.map(s => s.gymId))];

    // 2. Entries - fetchWorkoutEntriesForSessions owns the mock fallback
    const entries  = await fetchWorkoutEntriesForSessions(sessionIds);
    const entryIds = entries.map(e => e.id);

    // 3. Sets - fetchWorkoutSetsForEntries owns the mock fallback
    const sets = await fetchWorkoutSetsForEntries(entryIds);

    // 4. Photo data (URI included) - fetchPhotosForSessions owns the mock fallback
    const photoMap = await fetchPhotosForSessions(sessionIds);

    // 5. Gym display names - Supabase query with local GYMS mock as fallback
    const { data: gymData } = await supabase
      .from('gyms')
      .select('id, name, location')
      .in('id', gymIds);

    const gymMap = new Map<string, { name: string; location: string }>();
    for (const gymId of gymIds) {
      const live = (gymData ?? []).find(
        (g: { id: string }) => g.id === gymId,
      ) as { id: string; name: string; location: string } | undefined;
      gymMap.set(gymId, {
        name:     live?.name     ?? gymId,
        location: live?.location ?? '',
      });
    }

    // 6. Assemble WorkoutLog view objects
    const assembled = sessions.map(session => {
      const gym = gymMap.get(session.gymId) ?? { name: session.gymId, location: '' };

      const sessionEntries = entries
        .filter(e => e.sessionId === session.id)
        .sort((a, b) => a.order - b.order);

      const machines: LoggedMachineEntry[] = sessionEntries.map(entry => {
        const entrySets = sets.filter(s => s.entryId === entry.id);
        const maxSet    = entrySets.reduce<WorkoutSet | null>(
          (best, s) => (!best || s.weight > best.weight ? s : best),
          null,
        );
        return {
          machineId:    entry.machineId,
          machineName:  entry.machineName,
          machineBrand: entry.machineBrand,
          targetMuscle: entry.targetMuscle,
          weight:       maxSet?.weight ?? 0,
          reps:         maxSet?.reps   ?? 0,
          sets:         entrySets.length,
        };
      });

      const derivedMuscles = [...new Set(machines.map(m => m.targetMuscle).filter(Boolean))];
      const sessionMuscles = (session.targetMuscles && session.targetMuscles.length > 0)
        ? session.targetMuscles
        : derivedMuscles;

      return {
        id:               session.id,
        gymId:            session.gymId,
        gymName:          gym.name,
        gymLocation:      gym.location,
        date:             session.date,
        bodyWeight:       session.bodyWeight,
        machines,
        hasPhoto:         photoMap.has(session.id),
        compositeUri:     photoMap.get(session.id)?.compositeUri,
        photoUri:         photoMap.get(session.id)?.photoUri,
        thumbnailUri:     photoMap.get(session.id)?.thumbnailUri,
        overlayTextColor: session.overlayTextColor ?? '#ffffff',
        targetMuscles:    sessionMuscles,
      };
    });
    const assembledIds = new Set(assembled.map(s => s.id));
    const newSessions  = getNewSessions(userId).filter(s => !assembledIds.has(s.id));
    return [...newSessions, ...assembled];
  } catch (err) {
    if (__DEV__) console.warn('[db/workouts] fetchWorkoutLogs error:', err);
    return getNewSessions(userId);
  }
}

// --- Write helpers

/** Insert a new workout session. Returns the inserted row or throws. */
export async function insertWorkoutSession(
  session: Omit<WorkoutSession, 'id'> & { id?: string; overlayTextColor?: string },
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      id:                 session.id,
      user_id:            session.userId,
      gym_id:             session.gymId,
      date:               session.date,
      body_weight:        session.bodyWeight ?? null,
      notes:              session.notes ?? null,
      overlay_text_color: session.overlayTextColor ?? '#ffffff',
      target_muscles:     session.targetMuscles ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'insertWorkoutSession failed');
  return rowToSession(data);
}

/** Insert a new workout entry. Returns the inserted row or throws. */
export async function insertWorkoutEntry(
  entry: Omit<WorkoutEntry, 'id'> & { id?: string },
): Promise<WorkoutEntry> {
  const { data, error } = await supabase
    .from('workout_entries')
    .insert({
      id:            entry.id,
      session_id:    entry.sessionId,
      machine_id:    entry.machineId,
      machine_name:  entry.machineName,
      machine_brand: entry.machineBrand,
      target_muscle: entry.targetMuscle,
      sort_order:    entry.order,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'insertWorkoutEntry failed');
  return rowToEntry(data);
}

/** Insert a new workout set. Returns the inserted row or throws. */
export async function insertWorkoutSet(
  set: Omit<WorkoutSet, 'id'> & { id?: string },
): Promise<WorkoutSet> {
  const { data, error } = await supabase
    .from('workout_sets')
    .insert({
      id:         set.id,
      entry_id:   set.entryId,
      set_number: set.setNumber,
      weight:     set.weight,
      reps:       set.reps,
      is_pr:      set.isPR ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'insertWorkoutSet failed');
  track('log_set', { entry_id: set.entryId, weight: set.weight, reps: set.reps });
  return rowToSet(data);
}

/** Insert a new workout photo. Returns the inserted row or throws. */
export async function insertWorkoutPhoto(
  photo: Pick<WorkoutPhoto, 'sessionId' | 'userId' | 'capturedAt' | 'textColor' | 'aspectRatio' | 'thumbnailUri'>,
): Promise<WorkoutPhoto> {
  const { data, error } = await supabase
    .from('workout_photos')
    .insert({
      session_id:    photo.sessionId,
      user_id:       photo.userId,
      captured_at:   photo.capturedAt,
      text_color:    photo.textColor,
      aspect_ratio:  photo.aspectRatio ?? null,
      thumbnail_uri: photo.thumbnailUri ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'insertWorkoutPhoto failed');
  return rowToPhoto(data);
}

/** 운동 세션 및 연결 데이터 삭제 */
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  try {
    const { data: entries } = await supabase
      .from('workout_entries')
      .select('id')
      .eq('session_id', sessionId);

    if (entries?.length) {
      const entryIds = entries.map((e: { id: string }) => e.id);
      await supabase.from('workout_sets').delete().in('entry_id', entryIds);
      await supabase.from('workout_entries').delete().in('id', entryIds);
    }

    await supabase.from('workout_sessions').delete().eq('id', sessionId);

    if (__DEV__) console.log('[workouts] deleteWorkoutSession 완료:', sessionId);
  } catch (e) {
    if (__DEV__) console.warn('[workouts] deleteWorkoutSession 오류:', e);
    throw e;
  }
}
