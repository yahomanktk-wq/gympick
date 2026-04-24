// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoggedMachineEntry {
  machineId:    string;
  machineName:  string;
  machineBrand: string;
  targetMuscle: string;
  weight:       number;  // kg (0 for cardio)
  reps:         number;
  sets:         number;
}

export interface WorkoutSession {
  id:          string;
  gymId:       string;
  gymName:     string;
  gymLocation: string;
  date:        string;          // ISO 8601
  bodyWeight?: number;          // kg
  machines:    LoggedMachineEntry[];
  hasPhoto:    boolean;
}

// ─── Mock sessions ────────────────────────────────────────────────────────────

export const MOCK_SESSIONS: WorkoutSession[] = [
  {
    id:          'ws1',
    gymId:       'g01',
    gymName:     'IronHub Fitness',
    gymLocation: 'Gangnam-gu, Seoul',
    date:        '2026-03-05T10:30:00',
    bodyWeight:  78,
    hasPhoto:    true,
    machines: [
      { machineId: 'm02', machineName: 'Chest Press',     machineBrand: 'Life Fitness',    targetMuscle: 'Chest', weight: 70,   reps: 10, sets: 4 },
      { machineId: 'm05', machineName: 'Incline Press',   machineBrand: 'Hammer Strength', targetMuscle: 'Chest', weight: 60,   reps: 8,  sets: 3 },
      { machineId: 'm01', machineName: 'Cable Machine',   machineBrand: 'Life Fitness',    targetMuscle: 'Back',  weight: 55,   reps: 12, sets: 3 },
    ],
  },
  {
    id:          'ws2',
    gymId:       'g04',
    gymName:     'MaxLift Arena',
    gymLocation: 'Songpa-gu, Seoul',
    date:        '2026-03-03T18:15:00',
    bodyWeight:  78.5,
    hasPhoto:    false,
    machines: [
      { machineId: 'm04', machineName: 'Lat Pulldown',    machineBrand: 'Hammer Strength', targetMuscle: 'Back',      weight: 65,  reps: 10, sets: 4 },
      { machineId: 'm06', machineName: 'Hack Squat',      machineBrand: 'Hammer Strength', targetMuscle: 'Legs',      weight: 120, reps: 8,  sets: 3 },
      { machineId: 'm13', machineName: 'Power Rack',      machineBrand: 'Eleiko',          targetMuscle: 'Full Body', weight: 100, reps: 5,  sets: 5 },
    ],
  },
  {
    id:          'ws3',
    gymId:       'g01',
    gymName:     'IronHub Fitness',
    gymLocation: 'Gangnam-gu, Seoul',
    date:        '2026-03-01T09:00:00',
    bodyWeight:  79,
    hasPhoto:    true,
    machines: [
      { machineId: 'm02', machineName: 'Chest Press',     machineBrand: 'Life Fitness',    targetMuscle: 'Chest', weight: 67.5, reps: 10, sets: 4 },
      { machineId: 'm04', machineName: 'Lat Pulldown',    machineBrand: 'Hammer Strength', targetMuscle: 'Back',  weight: 62.5, reps: 12, sets: 3 },
    ],
  },
  {
    id:          'ws4',
    gymId:       'g05',
    gymName:     'FlexPoint Club',
    gymLocation: 'Seodaemun-gu, Seoul',
    date:        '2026-02-26T19:30:00',
    bodyWeight:  79,
    hasPhoto:    false,
    machines: [
      { machineId: 'm07', machineName: 'Treadmill',       machineBrand: 'Technogym',       targetMuscle: 'Full Body', weight: 0,    reps: 1,  sets: 1 },
      { machineId: 'm01', machineName: 'Cable Machine',   machineBrand: 'Life Fitness',    targetMuscle: 'Back',      weight: 52.5, reps: 12, sets: 3 },
    ],
  },
  {
    id:          'ws5',
    gymId:       'g04',
    gymName:     'MaxLift Arena',
    gymLocation: 'Songpa-gu, Seoul',
    date:        '2026-02-24T11:00:00',
    bodyWeight:  79.5,
    hasPhoto:    true,
    machines: [
      { machineId: 'm06', machineName: 'Hack Squat',      machineBrand: 'Hammer Strength', targetMuscle: 'Legs', weight: 110, reps: 10, sets: 4 },
      { machineId: 'm03', machineName: 'Leg Press',       machineBrand: 'Life Fitness',    targetMuscle: 'Legs', weight: 160, reps: 12, sets: 3 },
    ],
  },
  {
    id:          'ws6',
    gymId:       'g01',
    gymName:     'IronHub Fitness',
    gymLocation: 'Gangnam-gu, Seoul',
    date:        '2026-02-20T10:15:00',
    bodyWeight:  79.5,
    hasPhoto:    false,
    machines: [
      { machineId: 'm02', machineName: 'Chest Press',     machineBrand: 'Life Fitness',    targetMuscle: 'Chest', weight: 65,   reps: 10, sets: 4 },
      { machineId: 'm05', machineName: 'Incline Press',   machineBrand: 'Hammer Strength', targetMuscle: 'Chest', weight: 57.5, reps: 8,  sets: 3 },
      { machineId: 'm01', machineName: 'Cable Machine',   machineBrand: 'Life Fitness',    targetMuscle: 'Back',  weight: 50,   reps: 12, sets: 3 },
    ],
  },
  {
    id:          'ws7',
    gymId:       'g04',
    gymName:     'MaxLift Arena',
    gymLocation: 'Songpa-gu, Seoul',
    date:        '2026-02-17T17:45:00',
    bodyWeight:  80,
    hasPhoto:    false,
    machines: [
      { machineId: 'm06', machineName: 'Hack Squat',      machineBrand: 'Hammer Strength', targetMuscle: 'Legs', weight: 100, reps: 10, sets: 4 },
      { machineId: 'm04', machineName: 'Lat Pulldown',    machineBrand: 'Hammer Strength', targetMuscle: 'Back', weight: 60,  reps: 12, sets: 3 },
    ],
  },
];
