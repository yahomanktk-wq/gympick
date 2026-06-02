// freeWeights.ts — shared free-weight exercise list
// Used by PostWorkoutLogModal (member log) and ManagerDashboard (routine builder)
// Supabase machines 테이블과 동기화된 로컬 fallback 데이터

export interface FreeWeightExercise {
  id: string;
  name: string;
  targetMuscle: string;
  brand: string;
}

export const FREE_WEIGHTS: FreeWeightExercise[] = [
  // ── Chest ────────────────────────────────────────────────────
  { id: 'fw01', name: 'Dumbbell Decline Bench Press',  targetMuscle: 'Chest',     brand: 'Free Weight' },
  { id: 'fw02', name: 'Dumbbell Flat Bench Press',     targetMuscle: 'Chest',     brand: 'Free Weight' },
  { id: 'fw03', name: 'Dumbbell Incline Bench Press',  targetMuscle: 'Chest',     brand: 'Free Weight' },
  { id: 'fw04', name: 'Dumbbell Decline Fly',          targetMuscle: 'Chest',     brand: 'Free Weight' },
  { id: 'fw05', name: 'Dumbbell Fly',                  targetMuscle: 'Chest',     brand: 'Free Weight' },
  { id: 'fw06', name: 'Dumbbell Incline Fly',          targetMuscle: 'Chest',     brand: 'Free Weight' },
  { id: 'fw07', name: 'Dumbbell Pullover',             targetMuscle: 'Chest',     brand: 'Free Weight' },

  // ── Back ─────────────────────────────────────────────────────
  { id: 'fw08', name: 'Dumbbell Incline Row',          targetMuscle: 'Back',      brand: 'Free Weight' },
  { id: 'fw09', name: 'Bent Over Dumbbell Row',        targetMuscle: 'Back',      brand: 'Free Weight' },
  { id: 'fw10', name: 'One Arm Dumbbell Row',          targetMuscle: 'Back',      brand: 'Free Weight' },
  { id: 'fw11', name: 'Dumbbell Rear Delt Row',        targetMuscle: 'Back',      brand: 'Free Weight' },

  // ── Shoulders ────────────────────────────────────────────────
  { id: 'fw12', name: 'Dumbbell Reverse Fly',          targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw13', name: 'Dumbbell Front Raise',          targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw14', name: 'Dumbbell Side Lateral Raise',   targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw15', name: 'Arnold Dumbbell Press',         targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw16', name: 'Dumbbell Shoulder Press',       targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw17', name: 'Dumbbell Bent Over Raise',      targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw18', name: 'Dumbbell Shrug',                targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw19', name: 'Barbell Shrug',                 targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw20', name: 'Dumbbell Upright Row',          targetMuscle: 'Shoulder', brand: 'Free Weight' },
  { id: 'fw21', name: 'Barbell Upright Row',           targetMuscle: 'Shoulder', brand: 'Free Weight' },

  // ── Arms ─────────────────────────────────────────────────────
  { id: 'fw22', name: 'Dumbbell Triceps Extension',    targetMuscle: 'Arms',      brand: 'Free Weight' },
  { id: 'fw23', name: 'Dumbbell Biceps Curl',          targetMuscle: 'Arms',      brand: 'Free Weight' },
  { id: 'fw24', name: 'Dumbbell Hammer Curl',          targetMuscle: 'Arms',      brand: 'Free Weight' },
  { id: 'fw25', name: 'Dumbbell Incline Curl',         targetMuscle: 'Arms',      brand: 'Free Weight' },
  { id: 'fw26', name: 'Barbell Biceps Curl',           targetMuscle: 'Arms',      brand: 'Free Weight' },

  // ── Glutes ───────────────────────────────────────────────────
  { id: 'fw27', name: 'Glute Kickback',                targetMuscle: 'Glutes',    brand: 'Free Weight' },
  { id: 'fw28', name: 'Barbell Hip Thrust',            targetMuscle: 'Glutes',    brand: 'Free Weight' },
  { id: 'fw29', name: 'Single Leg Cable Kickback',     targetMuscle: 'Glutes',    brand: 'Free Weight' },

  // ── Legs ─────────────────────────────────────────────────────
  { id: 'fw30', name: 'Dumbbell Romanian Deadlift',    targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw31', name: 'Dumbbell Stiff Leg Deadlift',   targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw32', name: 'Single Leg Dumbbell Deadlift',  targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw33', name: 'Barbell Stiff Leg Deadlift',    targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw34', name: 'Barbell Deadlift',              targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw35', name: 'Barbell Romanian Deadlift',     targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw36', name: 'Barbell Good Morning',          targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw37', name: 'Dumbbell Goblet Squat',         targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw38', name: 'Dumbbell Sumo Squat',           targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw39', name: 'Dumbbell Split Squat',          targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw40', name: 'Barbell Squat',                 targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw41', name: 'Barbell Lunge',                 targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw42', name: 'Bulgarian Split Squat',         targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw43', name: 'Front Squat',                   targetMuscle: 'Leg',      brand: 'Free Weight' },
  { id: 'fw44', name: 'Barbell Split Squat',           targetMuscle: 'Leg',      brand: 'Free Weight' },
];
