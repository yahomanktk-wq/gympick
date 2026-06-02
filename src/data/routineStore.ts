// routineStore.ts — in-memory store for user routines
// Routines store machine order only; no sets/weights are stored.

export interface Routine {
  id: string;
  name: string;
  userId: string;
  gymId: string;
  bodyPart: string; // e.g. 'Chest', 'Back', 'Leg', etc.
  createdAt: string; // ISO date string
}

export interface RoutineMachine {
  routineId: string;
  machineId: string;
  order: number; // 0-indexed display order
}

// In-memory storage
let routines: Routine[] = [];
let routineMachines: RoutineMachine[] = [];

// ── Routine CRUD ───────────────────────────────────────────────

export function saveRoutine(
  userId: string,
  gymId: string,
  bodyPart: string,
  name: string,
  machineIds: string[], // ordered list
): Routine {
  const routine: Routine = {
    id: `r${Date.now()}`,
    name,
    userId,
    gymId,
    bodyPart,
    createdAt: new Date().toISOString(),
  };
  routines.push(routine);

  machineIds.forEach((machineId, index) => {
    routineMachines.push({ routineId: routine.id, machineId, order: index });
  });

  return routine;
}

export function getRoutines(userId: string): Routine[] {
  return routines
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRoutinesByGymAndBodyPart(
  userId: string,
  gymId: string,
  bodyPart: string,
): Routine[] {
  return routines
    .filter(
      (r) => r.userId === userId && r.gymId === gymId && r.bodyPart === bodyPart,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRoutineById(routineId: string): Routine | undefined {
  return routines.find((r) => r.id === routineId);
}

export function renameRoutine(routineId: string, newName: string): void {
  const r = routines.find((r) => r.id === routineId);
  if (r) r.name = newName;
}

export function deleteRoutine(routineId: string): void {
  routines = routines.filter((r) => r.id !== routineId);
  routineMachines = routineMachines.filter((rm) => rm.routineId !== routineId);
}

// ── RoutineMachine helpers ─────────────────────────────────────

/** Returns machine IDs for a routine in display order. */
export function getRoutineMachineIds(routineId: string): string[] {
  return routineMachines
    .filter((rm) => rm.routineId === routineId)
    .sort((a, b) => a.order - b.order)
    .map((rm) => rm.machineId);
}

/** Replaces the machine list for an existing routine (used when editing). */
export function updateRoutineMachines(routineId: string, machineIds: string[]): void {
  routineMachines = routineMachines.filter((rm) => rm.routineId !== routineId);
  machineIds.forEach((machineId, index) => {
    routineMachines.push({ routineId, machineId, order: index });
  });
}

// ── Gym-recommended routines (static mock) ────────────────────

export interface GymRoutine {
  id: string;
  gymId: string;
  name: string;
  bodyPart: string;
  machineIds: string[];
  authorLabel: string; // e.g. "Head Trainer Kim"
}

const GYM_ROUTINES: GymRoutine[] = [
  {
    id: 'gr01',
    gymId: 'g01',
    name: 'Chest Day Classic',
    bodyPart: 'Chest',
    machineIds: ['hammer_strength_chest_1', 'body_master_chest_1'],
    authorLabel: 'Head Trainer Kim',
  },
  {
    id: 'gr02',
    gymId: 'g01',
    name: 'Pull Day Essentials',
    bodyPart: 'Back',
    machineIds: ['arsenal_back_1', 'cybex_arm_10'],
    authorLabel: 'Head Trainer Kim',
  },
  {
    id: 'gr03',
    gymId: 'g02',
    name: 'Leg Strength Builder',
    bodyPart: 'Leg',
    machineIds: ['gymleco_leg_4'],
    authorLabel: 'Trainer Lee',
  },
];

export function getGymRoutines(gymId: string, bodyPart?: string): GymRoutine[] {
  return GYM_ROUTINES.filter(
    (gr) => gr.gymId === gymId && (!bodyPart || gr.bodyPart === bodyPart),
  );
}

// ── Community (shared) routines (static mock) ─────────────────

export interface CommunityRoutine {
  id: string;
  gymId: string;
  name: string;
  bodyPart: string;
  machineIds: string[];
  sharedByLabel: string; // display handle, no real user data exposed
}

const COMMUNITY_ROUTINES: CommunityRoutine[] = [
  {
    id: 'cr01',
    gymId: 'g01',
    name: 'Push Day (Member Share)',
    bodyPart: 'Chest',
    machineIds: ['hammer_strength_chest_1', 'body_master_chest_1'],
    sharedByLabel: 'Alex P.',
  },
  {
    id: 'cr02',
    gymId: 'g01',
    name: 'Quick Back Blast',
    bodyPart: 'Back',
    machineIds: ['arsenal_back_1'],
    sharedByLabel: 'Jordan K.',
  },
  {
    id: 'cr03',
    gymId: 'g02',
    name: 'Leg Day (Beginner)',
    bodyPart: 'Leg',
    machineIds: ['gymleco_leg_4'],
    sharedByLabel: 'Sam L.',
  },
];

export function getCommunityRoutines(gymId: string, bodyPart?: string): CommunityRoutine[] {
  return COMMUNITY_ROUTINES.filter(
    (cr) => cr.gymId === gymId && (!bodyPart || cr.bodyPart === bodyPart),
  );
}
