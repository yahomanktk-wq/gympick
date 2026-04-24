import type {
  WorkoutSession as DBWorkoutSession,
  WorkoutLog,
  LoggedMachineEntry,
  WorkoutEntry,
  WorkoutSet,
  WorkoutPhoto,
  ExerciseKind,
} from './types';

const M: ExerciseKind  = 'machine';
const FW: ExerciseKind = 'freeweight';

// Backward-compat re-export: screens that import WorkoutSession from this file
// receive WorkoutLog (the UI view), not the DB entity from types.ts.
export type { WorkoutLog as WorkoutSession };

// Re-export LoggedMachineEntry so existing screen imports keep working.
export type { LoggedMachineEntry };

// --- Normalized raw tables

export const RAW_WORKOUT_SESSIONS: DBWorkoutSession[] = [
  { id: 'ws1', userId: 'u1', gymId: 'g01', date: '2026-03-05T10:30:00', bodyWeight: 78    },
  { id: 'ws2', userId: 'u1', gymId: 'g04', date: '2026-03-03T18:15:00', bodyWeight: 78.5  },
  { id: 'ws3', userId: 'u1', gymId: 'g01', date: '2026-03-01T09:00:00', bodyWeight: 79    },
  { id: 'ws4', userId: 'u1', gymId: 'g05', date: '2026-02-26T19:30:00', bodyWeight: 79    },
  { id: 'ws5', userId: 'u1', gymId: 'g04', date: '2026-02-24T11:00:00', bodyWeight: 79.5  },
  { id: 'ws6', userId: 'u1', gymId: 'g01', date: '2026-02-20T10:15:00', bodyWeight: 79.5  },
  { id: 'ws7', userId: 'u1', gymId: 'g04', date: '2026-02-17T17:45:00', bodyWeight: 80    },
];

export const WORKOUT_ENTRIES: WorkoutEntry[] = [
  // ws1 - Chest + Back
  { id: 'we01', sessionId: 'ws1', machineId: 'm02', machineName: 'Chest Press',   machineBrand: 'Life Fitness',    targetMuscle: 'Chest',     exerciseKind: M,  order: 1 },
  { id: 'we02', sessionId: 'ws1', machineId: 'm05', machineName: 'Incline Press', machineBrand: 'Hammer Strength', targetMuscle: 'Chest',     exerciseKind: M,  order: 2 },
  { id: 'we03', sessionId: 'ws1', machineId: 'm01', machineName: 'Cable Machine', machineBrand: 'Life Fitness',    targetMuscle: 'Back',      exerciseKind: M,  order: 3 },
  // ws2 - Back + Legs + Full Body
  { id: 'we04', sessionId: 'ws2', machineId: 'm04', machineName: 'Lat Pulldown',  machineBrand: 'Hammer Strength', targetMuscle: 'Back',      exerciseKind: M,  order: 1 },
  { id: 'we05', sessionId: 'ws2', machineId: 'm06', machineName: 'Hack Squat',    machineBrand: 'Hammer Strength', targetMuscle: 'Legs',      exerciseKind: M,  order: 2 },
  { id: 'we06', sessionId: 'ws2', machineId: 'm13', machineName: 'Power Rack',    machineBrand: 'Eleiko',          targetMuscle: 'Full Body', exerciseKind: FW, order: 3 },
  // ws3 - Chest + Back
  { id: 'we07', sessionId: 'ws3', machineId: 'm02', machineName: 'Chest Press',   machineBrand: 'Life Fitness',    targetMuscle: 'Chest',     exerciseKind: M,  order: 1 },
  { id: 'we08', sessionId: 'ws3', machineId: 'm04', machineName: 'Lat Pulldown',  machineBrand: 'Hammer Strength', targetMuscle: 'Back',      exerciseKind: M,  order: 2 },
  // ws4 - Cardio + Back
  { id: 'we09', sessionId: 'ws4', machineId: 'm07', machineName: 'Treadmill',     machineBrand: 'Technogym',       targetMuscle: 'Full Body', exerciseKind: M,  order: 1 },
  { id: 'we10', sessionId: 'ws4', machineId: 'm01', machineName: 'Cable Machine', machineBrand: 'Life Fitness',    targetMuscle: 'Back',      exerciseKind: M,  order: 2 },
  // ws5 - Legs
  { id: 'we11', sessionId: 'ws5', machineId: 'm06', machineName: 'Hack Squat',    machineBrand: 'Hammer Strength', targetMuscle: 'Legs',      exerciseKind: M,  order: 1 },
  { id: 'we12', sessionId: 'ws5', machineId: 'm03', machineName: 'Leg Press',     machineBrand: 'Life Fitness',    targetMuscle: 'Legs',      exerciseKind: M,  order: 2 },
  // ws6 - Chest + Back
  { id: 'we13', sessionId: 'ws6', machineId: 'm02', machineName: 'Chest Press',   machineBrand: 'Life Fitness',    targetMuscle: 'Chest',     exerciseKind: M,  order: 1 },
  { id: 'we14', sessionId: 'ws6', machineId: 'm05', machineName: 'Incline Press', machineBrand: 'Hammer Strength', targetMuscle: 'Chest',     exerciseKind: M,  order: 2 },
  { id: 'we15', sessionId: 'ws6', machineId: 'm01', machineName: 'Cable Machine', machineBrand: 'Life Fitness',    targetMuscle: 'Back',      exerciseKind: M,  order: 3 },
  // ws7 - Legs + Back
  { id: 'we16', sessionId: 'ws7', machineId: 'm06', machineName: 'Hack Squat',    machineBrand: 'Hammer Strength', targetMuscle: 'Legs',      exerciseKind: M,  order: 1 },
  { id: 'we17', sessionId: 'ws7', machineId: 'm04', machineName: 'Lat Pulldown',  machineBrand: 'Hammer Strength', targetMuscle: 'Back',      exerciseKind: M,  order: 2 },
];

// --- Helper: generate identical sets for an entry

function makeSets(
  entryId: string,
  count: number,
  weight: number,
  reps: number,
): WorkoutSet[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${entryId}_s${i + 1}`,
    entryId,
    setNumber: i + 1,
    weight,
    reps,
  }));
}

export const WORKOUT_SETS: WorkoutSet[] = [
  ...makeSets('we01', 4, 70,    10),   // ws1 Chest Press
  ...makeSets('we02', 3, 60,    8),    // ws1 Incline Press
  ...makeSets('we03', 3, 55,    12),   // ws1 Cable Machine
  ...makeSets('we04', 4, 65,    10),   // ws2 Lat Pulldown
  ...makeSets('we05', 3, 120,   8),    // ws2 Hack Squat
  ...makeSets('we06', 5, 100,   5),    // ws2 Power Rack
  ...makeSets('we07', 4, 67.5,  10),   // ws3 Chest Press
  ...makeSets('we08', 3, 62.5,  12),   // ws3 Lat Pulldown
  ...makeSets('we09', 1, 0,     1),    // ws4 Treadmill (cardio)
  ...makeSets('we10', 3, 52.5,  12),   // ws4 Cable Machine
  ...makeSets('we11', 4, 110,   10),   // ws5 Hack Squat
  ...makeSets('we12', 3, 160,   12),   // ws5 Leg Press
  ...makeSets('we13', 4, 65,    10),   // ws6 Chest Press
  ...makeSets('we14', 3, 57.5,  8),    // ws6 Incline Press
  ...makeSets('we15', 3, 50,    12),   // ws6 Cable Machine
  ...makeSets('we16', 4, 100,   10),   // ws7 Hack Squat
  ...makeSets('we17', 3, 60,    12),   // ws7 Lat Pulldown
];

export const WORKOUT_PHOTOS: WorkoutPhoto[] = [
  { id: 'wp01', sessionId: 'ws1', userId: 'u1', capturedAt: '2026-03-05T11:15:00', textColor: '#ffffff' },
  { id: 'wp02', sessionId: 'ws3', userId: 'u1', capturedAt: '2026-03-01T09:55:00', textColor: '#c8ff57' },
  { id: 'wp03', sessionId: 'ws5', userId: 'u1', capturedAt: '2026-02-24T12:00:00', textColor: '#ffffff' },
];

// --- Gym info map (for gymName / gymLocation in the view layer)

const GYM_INFO: Record<string, { name: string; location: string }> = {
  g01: { name: 'IronHub Fitness',  location: '서울시 강남구'     },
  g02: { name: 'PulseZone Gym',    location: '서울시 마포구'     },
  g03: { name: 'CoreForge Studio', location: '서울시 용산구'     },
  g04: { name: 'MaxLift Arena',    location: '서울시 송파구'     },
  g05: { name: 'FlexPoint Club',   location: '서울시 서대문구'   },
  g06: { name: 'Apex Performance', location: '서울시 서초구'     },
  g07: { name: 'Momentum Fitness', location: '서울시 노원구'     },
  g08: { name: 'UrbanSweat Gym',   location: '서울시 종로구'     },
};

// --- Derived MOCK_SESSIONS - backward-compat view
// Aggregates normalized tables back into the flat shape expected by the UI.

export const MOCK_SESSIONS: WorkoutLog[] = RAW_WORKOUT_SESSIONS.map(session => {
  const gymInfo = GYM_INFO[session.gymId] ?? { name: session.gymId, location: '' };

  const entries = WORKOUT_ENTRIES
    .filter(e => e.sessionId === session.id)
    .sort((a, b) => a.order - b.order);

  const machines: LoggedMachineEntry[] = entries.map(entry => {
    const sets = WORKOUT_SETS.filter(s => s.entryId === entry.id);
    const setCount = sets.length;

    // Max-weight set determines the representative weight/reps
    const maxSet = sets.reduce<WorkoutSet | null>((best, s) => {
      if (!best || s.weight > best.weight) return s;
      return best;
    }, null);

    return {
      machineId:    entry.machineId,
      machineName:  entry.machineName,
      machineBrand: entry.machineBrand,
      targetMuscle: entry.targetMuscle,
      weight:       maxSet?.weight ?? 0,
      reps:         maxSet?.reps   ?? 0,
      sets:         setCount,
    };
  });

  const hasPhoto = WORKOUT_PHOTOS.some(p => p.sessionId === session.id);

  return {
    id:          session.id,
    gymId:       session.gymId,
    gymName:     gymInfo.name,
    gymLocation: gymInfo.location,
    date:        session.date,
    bodyWeight:  session.bodyWeight,
    machines,
    hasPhoto,
  };
});

// --- PR utilities (operate on WorkoutLog view)

/** machineId → all-time max weight across all sessions */
export function getMachinePRs(sessions: WorkoutLog[]): Record<string, number> {
  const prs: Record<string, number> = {};
  for (const session of sessions) {
    for (const m of session.machines) {
      if (m.weight > 0 && (prs[m.machineId] === undefined || m.weight > prs[m.machineId])) {
        prs[m.machineId] = m.weight;
      }
    }
  }
  return prs;
}

/** machineId → { weight, reps } of the best-weight set ever logged */
export function getMachinePRsFull(
  sessions: WorkoutLog[],
): Record<string, { weight: number; reps: number }> {
  const prs: Record<string, { weight: number; reps: number }> = {};
  for (const session of sessions) {
    for (const m of session.machines) {
      if (m.weight > 0 && (prs[m.machineId] === undefined || m.weight > prs[m.machineId].weight)) {
        prs[m.machineId] = { weight: m.weight, reps: m.reps };
      }
    }
  }
  return prs;
}

/**
 * Returns a map of sessionId → Set of machineIds that set a new personal
 * record *at the time of that session* (chronological comparison).
 */
export function getSessionPRMachines(
  sessions: WorkoutLog[],
): Record<string, Set<string>> {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const runningMax: Record<string, number> = {};
  const result: Record<string, Set<string>> = {};
  for (const session of sorted) {
    const prSet = new Set<string>();
    for (const m of session.machines) {
      if (
        m.weight > 0 &&
        (runningMax[m.machineId] === undefined || m.weight > runningMax[m.machineId])
      ) {
        prSet.add(m.machineId);
        runningMax[m.machineId] = m.weight;
      }
    }
    result[session.id] = prSet;
  }
  return result;
}

// --- New normalized PR utilities

/**
 * machineId → { weight, reps } of the best-weight WorkoutSet ever logged,
 * computed directly from the normalized tables (no view layer needed).
 */
export function getMachinePRsFromSets(
  entries: WorkoutEntry[],
  sets: WorkoutSet[],
): Record<string, { weight: number; reps: number }> {
  const prs: Record<string, { weight: number; reps: number }> = {};
  for (const set of sets) {
    if (set.weight <= 0) continue;
    const entry = entries.find(e => e.id === set.entryId);
    if (!entry) continue;
    const machineId = entry.machineId;
    if (prs[machineId] === undefined || set.weight > prs[machineId].weight) {
      prs[machineId] = { weight: set.weight, reps: set.reps };
    }
  }
  return prs;
}

/**
 * sessionId → Set<machineId> of machines that hit a new PR *at the time of
 * that session*, computed from the normalized tables chronologically.
 */
export function getSessionPRMachinesFromSets(
  sessions: DBWorkoutSession[],
  entries: WorkoutEntry[],
  sets: WorkoutSet[],
): Record<string, Set<string>> {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const runningMax: Record<string, number> = {};
  const result: Record<string, Set<string>> = {};

  for (const session of sorted) {
    const sessionEntries = entries.filter(e => e.sessionId === session.id);
    const prSet = new Set<string>();

    for (const entry of sessionEntries) {
      const entrySets = sets.filter(s => s.entryId === entry.id && s.weight > 0);
      const maxWeight = entrySets.reduce((max, s) => Math.max(max, s.weight), 0);
      if (maxWeight > 0) {
        if (
          runningMax[entry.machineId] === undefined ||
          maxWeight > runningMax[entry.machineId]
        ) {
          prSet.add(entry.machineId);
          runningMax[entry.machineId] = maxWeight;
        }
      }
    }

    result[session.id] = prSet;
  }

  return result;
}
