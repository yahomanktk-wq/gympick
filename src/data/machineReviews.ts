import { MachineReview, FavoriteMachine } from './types';

// --- Machine reviews

export const MACHINE_REVIEWS: MachineReview[] = [
  // arsenal_back_1 - Selectorized Lat Pulldown (Arsenal)
  {
    id: 'mr01',
    machineId: 'arsenal_back_1',
    userId: 'u_daniel_k',
    userName: 'Daniel K.',
    userInitials: 'DK',
    rating: 5,
    text: 'Best machine in the gym. Great range of motion and smooth cable tension throughout.',
    createdAt: '2026-03-03',
  },
  {
    id: 'mr02',
    machineId: 'arsenal_back_1',
    userId: 'u_emma_r',
    userName: 'Emma R.',
    userInitials: 'ER',
    rating: 5,
    text: 'Incredibly smooth. The ergonomics are well-designed — my form improved within a week.',
    createdAt: '2026-02-12',
  },
  {
    id: 'mr03',
    machineId: 'arsenal_back_1',
    userId: 'u_noah_l',
    userName: 'Noah L.',
    userInitials: 'NL',
    rating: 4,
    text: 'Great for lat isolation. Always well-maintained. Highly recommend.',
    createdAt: '2026-02-05',
  },

  // hammer_strength_chest_1 - Select Chest Press (Hammer Strength)
  {
    id: 'mr04',
    machineId: 'hammer_strength_chest_1',
    userId: 'u_sora_y',
    userName: 'Sora Y.',
    userInitials: 'SY',
    rating: 4,
    text: 'Solid build quality. Wish the seat was a bit more adjustable but does the job perfectly.',
    createdAt: '2026-02-28',
  },
  {
    id: 'mr05',
    machineId: 'hammer_strength_chest_1',
    userId: 'u_marcus_t',
    userName: 'Marcus T.',
    userInitials: 'MT',
    rating: 5,
    text: "Really feel the chest working. Can't imagine training without this now.",
    createdAt: '2026-02-22',
  },
  {
    id: 'mr06',
    machineId: 'hammer_strength_chest_1',
    userId: 'u_tyler_b',
    userName: 'Tyler B.',
    userInitials: 'TB',
    rating: 4,
    text: 'Consistent press path through the full range. No dead spots. Really impressed.',
    createdAt: '2026-01-25',
  },

  // atlantis_leg_12 - Precision Seated Leg Curl (Atlantis)
  {
    id: 'mr07',
    machineId: 'atlantis_leg_12',
    userId: 'u_minji_c',
    userName: 'Minji C.',
    userInitials: 'MC',
    rating: 5,
    text: 'My go-to machine every leg day. The cam profile is perfect for hamstring activation.',
    createdAt: '2026-01-30',
  },
  {
    id: 'mr08',
    machineId: 'atlantis_leg_12',
    userId: 'u_jihyun_p',
    userName: 'Ji-hyun P.',
    userInitials: 'JP',
    rating: 3,
    text: 'Good machine but the weight stack clicks at the higher end. Still usable though.',
    createdAt: '2026-02-18',
  },

  // gym80_leg_14 - Leg Extension (Gym80)
  {
    id: 'mr09',
    machineId: 'gym80_leg_14',
    userId: 'u_noah_l',
    userName: 'Noah L.',
    userInitials: 'NL',
    rating: 5,
    text: 'Incredibly smooth extension. German build quality really shows. Top tier.',
    createdAt: '2026-03-01',
  },
  {
    id: 'mr10',
    machineId: 'gym80_leg_14',
    userId: 'u_emma_r',
    userName: 'Emma R.',
    userInitials: 'ER',
    rating: 4,
    text: 'Smooth cam with good weight increments. A staple machine for quad day.',
    createdAt: '2026-02-14',
  },

  // precor_shoulder_5 - Converging Shoulder Press (Precor)
  {
    id: 'mr11',
    machineId: 'precor_shoulder_5',
    userId: 'u_marcus_t',
    userName: 'Marcus T.',
    userInitials: 'MT',
    rating: 5,
    text: 'Converging path really targets the front delts. Solid build, great ergonomics.',
    createdAt: '2026-02-25',
  },
  {
    id: 'mr12',
    machineId: 'precor_shoulder_5',
    userId: 'u_daniel_k',
    userName: 'Daniel K.',
    userInitials: 'DK',
    rating: 5,
    text: 'Best shoulder press in the gym. Perfectly balanced and easy to load.',
    createdAt: '2026-03-02',
  },
];

// --- Favorite machines

export const FAVORITE_MACHINES: FavoriteMachine[] = [
  { id: 'fm01', userId: 'u1', machineId: 'arsenal_back_1',         createdAt: '2026-02-10' },
  { id: 'fm02', userId: 'u1', machineId: 'hammer_strength_chest_1', createdAt: '2026-02-15' },
  { id: 'fm03', userId: 'u1', machineId: 'atlantis_leg_12',         createdAt: '2026-02-20' },
];

// --- Query helpers

/** Returns all reviews for a given machine, sorted newest-first. */
export function getMachineReviews(machineId: string): MachineReview[] {
  return MACHINE_REVIEWS
    .filter(r => r.machineId === machineId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns the machineIds favourited by a given user. */
export function getUserFavorites(userId: string): string[] {
  return FAVORITE_MACHINES
    .filter(f => f.userId === userId)
    .map(f => f.machineId);
}

/** Returns true if the given user has favourited the given machine. */
export function isUserFavorite(userId: string, machineId: string): boolean {
  return FAVORITE_MACHINES.some(f => f.userId === userId && f.machineId === machineId);
}
