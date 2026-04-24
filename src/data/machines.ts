import { Machine } from './types';

export const MACHINES: Machine[] = [
  // ── Life Fitness ─────────────────────────────────────────────────────────
  {
    id: 'm01',
    name: 'Cable Machine',
    brand: 'Life Fitness',
    targetMuscle: 'Back',
    category: 'Strength',
    gymIds: ['g01', 'g03', 'g04', 'g05', 'g06'],
  },
  {
    id: 'm02',
    name: 'Chest Press',
    brand: 'Life Fitness',
    targetMuscle: 'Chest',
    category: 'Strength',
    gymIds: ['g01', 'g05', 'g08'],
  },
  {
    id: 'm03',
    name: 'Leg Press',
    brand: 'Life Fitness',
    targetMuscle: 'Legs',
    category: 'Strength',
    gymIds: ['g01', 'g04', 'g07'],
  },

  // ── Hammer Strength ───────────────────────────────────────────────────────
  {
    id: 'm04',
    name: 'Lat Pulldown',
    brand: 'Hammer Strength',
    targetMuscle: 'Back',
    category: 'Strength',
    gymIds: ['g01', 'g04', 'g05'],
  },
  {
    id: 'm05',
    name: 'Incline Press',
    brand: 'Hammer Strength',
    targetMuscle: 'Chest',
    category: 'Strength',
    gymIds: ['g01', 'g04'],
  },
  {
    id: 'm06',
    name: 'Hack Squat',
    brand: 'Hammer Strength',
    targetMuscle: 'Legs',
    category: 'Strength',
    gymIds: ['g04', 'g07'],
  },

  // ── Technogym ─────────────────────────────────────────────────────────────
  {
    id: 'm07',
    name: 'Treadmill',
    brand: 'Technogym',
    targetMuscle: 'Full Body',
    category: 'Cardio',
    gymIds: ['g02', 'g05', 'g08'],
  },
  {
    id: 'm08',
    name: 'Rowing Machine',
    brand: 'Technogym',
    targetMuscle: 'Full Body',
    category: 'Cardio',
    gymIds: ['g02', 'g05'],
  },
  {
    id: 'm09',
    name: 'Skillmill',
    brand: 'Technogym',
    targetMuscle: 'Full Body',
    category: 'Cardio',
    gymIds: ['g02', 'g08'],
  },

  // ── Concept2 ──────────────────────────────────────────────────────────────
  {
    id: 'm10',
    name: 'Rowing Ergometer',
    brand: 'Concept2',
    targetMuscle: 'Full Body',
    category: 'Cardio',
    gymIds: ['g02', 'g06'],
  },
  {
    id: 'm11',
    name: 'SkiErg',
    brand: 'Concept2',
    targetMuscle: 'Core',
    category: 'HIIT',
    gymIds: ['g02', 'g06'],
  },

  // ── Eleiko ────────────────────────────────────────────────────────────────
  {
    id: 'm12',
    name: 'Olympic Barbell',
    brand: 'Eleiko',
    targetMuscle: 'Full Body',
    category: 'Powerlifting',
    gymIds: ['g04', 'g06', 'g07'],
  },
  {
    id: 'm13',
    name: 'Power Rack',
    brand: 'Eleiko',
    targetMuscle: 'Full Body',
    category: 'Powerlifting',
    gymIds: ['g04', 'g07'],
  },

  // ── Rogue ─────────────────────────────────────────────────────────────────
  {
    id: 'm14',
    name: 'Assault Bike',
    brand: 'Rogue',
    targetMuscle: 'Full Body',
    category: 'CrossFit',
    gymIds: ['g06'],
  },
  {
    id: 'm15',
    name: 'GHD Machine',
    brand: 'Rogue',
    targetMuscle: 'Core',
    category: 'CrossFit',
    gymIds: ['g06'],
  },

  // ── Precor ────────────────────────────────────────────────────────────────
  {
    id: 'm16',
    name: 'EFX Elliptical',
    brand: 'Precor',
    targetMuscle: 'Full Body',
    category: 'Cardio',
    gymIds: ['g03', 'g08'],
  },
  {
    id: 'm17',
    name: 'Functional Trainer',
    brand: 'Precor',
    targetMuscle: 'Back',
    category: 'Strength',
    gymIds: ['g03', 'g08'],
  },

  // ── Balanced Body ─────────────────────────────────────────────────────────
  {
    id: 'm18',
    name: 'Reformer',
    brand: 'Balanced Body',
    targetMuscle: 'Core',
    category: 'Pilates',
    gymIds: ['g03'],
  },
  {
    id: 'm19',
    name: 'Cadillac',
    brand: 'Balanced Body',
    targetMuscle: 'Core',
    category: 'Pilates',
    gymIds: ['g03'],
  },

  // ── Matrix ────────────────────────────────────────────────────────────────
  {
    id: 'm20',
    name: 'Smith Machine',
    brand: 'Matrix',
    targetMuscle: 'Shoulders',
    category: 'Strength',
    gymIds: ['g01', 'g04', 'g07', 'g08'],
  },
  {
    id: 'm21',
    name: 'Glute Bridge Machine',
    brand: 'Matrix',
    targetMuscle: 'Glutes',
    category: 'Strength',
    gymIds: ['g03', 'g07'],
  },

  // ── Cybex ─────────────────────────────────────────────────────────────────
  {
    id: 'm22',
    name: 'Arc Trainer',
    brand: 'Cybex',
    targetMuscle: 'Legs',
    category: 'Cardio',
    gymIds: ['g05', 'g08'],
  },
  {
    id: 'm23',
    name: 'VR3 Cable',
    brand: 'Cybex',
    targetMuscle: 'Back',
    category: 'Strength',
    gymIds: ['g05'],
  },
];
