import { GymMachineLink } from './types';

// --- Join table: gym ↔ machine
// Single source of truth for which machines exist in which gyms.
// Machine.gymIds and Gym.machineIds are both derived from this table.

export const GYM_MACHINES: GymMachineLink[] = [
  // g01 - IronHub Fitness (Gangnam-gu)
  { gymId: 'g01', machineId: 'arsenal_back_1',         unitCount: 3, condition: 'good' },
  { gymId: 'g01', machineId: 'hammer_strength_chest_1', unitCount: 2, condition: 'good' },
  { gymId: 'g01', machineId: 'body_master_chest_1',     unitCount: 1, condition: 'good' },
  { gymId: 'g01', machineId: 'cybex_arm_10',            unitCount: 2, condition: 'good' },
  { gymId: 'g01', machineId: 'atlantis_shoulder_6',     unitCount: 1, condition: 'good' },
  { gymId: 'g01', machineId: 'gym80_leg_14',            unitCount: 2, condition: 'good' },

  // g02 - PulseZone Gym (Mapo-gu)
  { gymId: 'g02', machineId: 'body_master_back_1',      unitCount: 4, condition: 'good' },
  { gymId: 'g02', machineId: 'body_master_chest_2',     unitCount: 3, condition: 'good' },
  { gymId: 'g02', machineId: 'cybex_arm_11',            unitCount: 2, condition: 'good' },
  { gymId: 'g02', machineId: 'precor_shoulder_5',       unitCount: 2, condition: 'good' },
  { gymId: 'g02', machineId: 'gymleco_leg_4',           unitCount: 3, condition: 'fair' },

  // g03 - CoreForge Studio (Yongsan-gu)
  { gymId: 'g03', machineId: 'arsenal_back_3',          unitCount: 2, condition: 'good' },
  { gymId: 'g03', machineId: 'body_master_back_4',      unitCount: 2, condition: 'good' },
  { gymId: 'g03', machineId: 'life_fitness_chest_2',    unitCount: 2, condition: 'good' },
  { gymId: 'g03', machineId: 'gym80_shoulder_4',        unitCount: 1, condition: 'good' },
  { gymId: 'g03', machineId: 'gym80_leg_4',             unitCount: 3, condition: 'good' },
  { gymId: 'g03', machineId: 'arsenal_leg_3',           unitCount: 2, condition: 'good' },

  // g04 - MaxLift Arena (Songpa-gu)
  { gymId: 'g04', machineId: 'arsenal_back_1',          unitCount: 4, condition: 'good' },
  { gymId: 'g04', machineId: 'body_master_back_2',      unitCount: 2, condition: 'good' },
  { gymId: 'g04', machineId: 'hammer_strength_chest_5', unitCount: 3, condition: 'good' },
  { gymId: 'g04', machineId: 'icarian_arm_1',           unitCount: 2, condition: 'good' },
  { gymId: 'g04', machineId: 'precor_shoulder_6',       unitCount: 2, condition: 'good' },
  { gymId: 'g04', machineId: 'atlantis_leg_12',         unitCount: 4, condition: 'good' },
  { gymId: 'g04', machineId: 'life_fitness_leg_25',     unitCount: 2, condition: 'fair' },

  // g05 - FlexPoint Club (Seodaemun-gu)
  { gymId: 'g05', machineId: 'arsenal_back_1',          unitCount: 2, condition: 'good' },
  { gymId: 'g05', machineId: 'hoist_chest_1',           unitCount: 2, condition: 'good' },
  { gymId: 'g05', machineId: 'body_master_chest_3',     unitCount: 1, condition: 'good' },
  { gymId: 'g05', machineId: 'cybex_arm_1',             unitCount: 2, condition: 'good' },
  { gymId: 'g05', machineId: 'precor_shoulder_4',       unitCount: 1, condition: 'good' },
  { gymId: 'g05', machineId: 'gymleco_leg_5',           unitCount: 3, condition: 'good' },
  { gymId: 'g05', machineId: 'hoist_leg_8',             unitCount: 2, condition: 'good' },

  // g06 - Apex Performance (Seocho-gu)
  { gymId: 'g06', machineId: 'body_master_back_3',      unitCount: 3, condition: 'good' },
  { gymId: 'g06', machineId: 'body_master_back_5',      unitCount: 2, condition: 'good' },
  { gymId: 'g06', machineId: 'life_fitness_chest_6',    unitCount: 4, condition: 'good' },
  { gymId: 'g06', machineId: 'cybex_arm_13',            unitCount: 3, condition: 'good' },
  { gymId: 'g06', machineId: 'atlantis_leg_4',          unitCount: 3, condition: 'good' },
  { gymId: 'g06', machineId: 'life_fitness_leg_13',     unitCount: 2, condition: 'good' },

  // g07 - Momentum Fitness (Nowon-gu) - neighbourhood gym, some fair-condition units
  { gymId: 'g07', machineId: 'cybex_back_1',            unitCount: 2, condition: 'fair' },
  { gymId: 'g07', machineId: 'body_master_chest_4',     unitCount: 1, condition: 'good' },
  { gymId: 'g07', machineId: 'cybex_arm_15',            unitCount: 2, condition: 'fair' },
  { gymId: 'g07', machineId: 'gym80_shoulder_4',        unitCount: 1, condition: 'good' },
  { gymId: 'g07', machineId: 'dynamic_leg_6',           unitCount: 2, condition: 'good' },
  { gymId: 'g07', machineId: 'panatta_leg_10',          unitCount: 1, condition: 'good' },

  // g08 - UrbanSweat Gym (Jongno-gu)
  { gymId: 'g08', machineId: 'hammer_strength_back_6',  unitCount: 3,  condition: 'good' },
  { gymId: 'g08', machineId: 'cybex_back_10',           unitCount: 2,  condition: 'good' },
  { gymId: 'g08', machineId: 'hammer_strength_chest_7', unitCount: 2,  condition: 'good' },
  { gymId: 'g08', machineId: 'body_master_arm_1',       unitCount: 2,  condition: 'good' },
  { gymId: 'g08', machineId: 'precor_shoulder_5',       unitCount: 2,  condition: 'good' },
  { gymId: 'g08', machineId: 'star_trac_leg_7',         unitCount: 4,  condition: 'good' },
  { gymId: 'g08', machineId: 'strive_leg_1',            unitCount: 2,  condition: 'good' },
];

// --- Lookup helpers

/** Returns all machineIds available at a given gym (in join-table order). */
export function getGymMachineIds(gymId: string): string[] {
  return GYM_MACHINES
    .filter(link => link.gymId === gymId)
    .map(link => link.machineId);
}

/** Returns all gymIds that have a given machine. */
export function getMachineGymIds(machineId: string): string[] {
  return GYM_MACHINES
    .filter(link => link.machineId === machineId)
    .map(link => link.gymId);
}

/** Returns full GymMachineLink rows for a gym (for inventory / equipment views). */
export function getGymMachineLinks(gymId: string): GymMachineLink[] {
  return GYM_MACHINES.filter(link => link.gymId === gymId);
}
