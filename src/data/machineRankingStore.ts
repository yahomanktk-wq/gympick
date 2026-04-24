import { MachineRankingEntry } from './types';

// ── Mock ranking data (18 entries: 6 muscles × 3 ranks) ─────────────────────

export const MOCK_MACHINE_RANKINGS: MachineRankingEntry[] = [
  // CHEST
  { rank: 1, machineId: 'm01', machineName: 'Chest Press',         brandName: 'Life Fitness',  muscle: 'CHEST',     usageCount: 1240, usageChange: 'same' },
  { rank: 2, machineId: 'm02', machineName: 'Pec Deck Fly',        brandName: 'Technogym',     muscle: 'CHEST',     usageCount:  980, usageChange: 'up'   },
  { rank: 3, machineId: 'm03', machineName: 'Cable Crossover',     brandName: 'Matrix',        muscle: 'CHEST',     usageCount:  740, usageChange: 'down' },

  // BACK
  { rank: 1, machineId: 'm04', machineName: 'Lat Pulldown',        brandName: 'Life Fitness',  muscle: 'BACK',      usageCount: 1180, usageChange: 'up'   },
  { rank: 2, machineId: 'm05', machineName: 'Seated Row',          brandName: 'Hammer Strength', muscle: 'BACK',    usageCount:  870, usageChange: 'same' },
  { rank: 3, machineId: 'm06', machineName: 'Assisted Pull-Up',    brandName: 'Matrix',        muscle: 'BACK',      usageCount:  620, usageChange: 'down' },

  // LEGS
  { rank: 1, machineId: 'm07', machineName: 'Leg Press',           brandName: 'Technogym',     muscle: 'LEGS',      usageCount: 1560, usageChange: 'up'   },
  { rank: 2, machineId: 'm08', machineName: 'Leg Extension',       brandName: 'Life Fitness',  muscle: 'LEGS',      usageCount: 1020, usageChange: 'down' },
  { rank: 3, machineId: 'm09', machineName: 'Leg Curl',            brandName: 'Hammer Strength', muscle: 'LEGS',    usageCount:  780, usageChange: 'same' },

  // SHOULDERS
  { rank: 1, machineId: 'm10', machineName: 'Shoulder Press',      brandName: 'Life Fitness',  muscle: 'SHOULDERS', usageCount:  890, usageChange: 'same' },
  { rank: 2, machineId: 'm11', machineName: 'Lateral Raise Machine', brandName: 'Matrix',      muscle: 'SHOULDERS', usageCount:  650, usageChange: 'up'   },
  { rank: 3, machineId: 'm12', machineName: 'Rear Delt Fly',       brandName: 'Technogym',     muscle: 'SHOULDERS', usageCount:  420, usageChange: 'down' },

  // ARMS
  { rank: 1, machineId: 'm13', machineName: 'Preacher Curl',       brandName: 'Hammer Strength', muscle: 'ARMS',    usageCount:  730, usageChange: 'down' },
  { rank: 2, machineId: 'm14', machineName: 'Tricep Pushdown',     brandName: 'Life Fitness',  muscle: 'ARMS',      usageCount:  680, usageChange: 'up'   },
  { rank: 3, machineId: 'm15', machineName: 'Cable Bicep Curl',    brandName: 'Matrix',        muscle: 'ARMS',      usageCount:  510, usageChange: 'same' },

  // GLUTES
  { rank: 1, machineId: 'm16', machineName: 'Hip Thrust Machine',  brandName: 'Technogym',     muscle: 'GLUTES',    usageCount:  940, usageChange: 'up'   },
  { rank: 2, machineId: 'm17', machineName: 'Glute Kickback',      brandName: 'Matrix',        muscle: 'GLUTES',    usageCount:  710, usageChange: 'same' },
  { rank: 3, machineId: 'm18', machineName: 'Cable Hip Extension', brandName: 'Life Fitness',  muscle: 'GLUTES',    usageCount:  480, usageChange: 'down' },
];

// ── Functions ─────────────────────────────────────────────────────────────────

/** 부위별 랭킹 조회 (상위 3개) */
export function getRankingByMuscle(muscle: string): MachineRankingEntry[] {
  return MOCK_MACHINE_RANKINGS.filter(
    e => e.muscle.toUpperCase() === muscle.toUpperCase(),
  ).sort((a, b) => a.rank - b.rank);
}

/** 전체 랭킹 조회 */
export function getAllRankings(): MachineRankingEntry[] {
  return [...MOCK_MACHINE_RANKINGS].sort((a, b) => {
    if (a.muscle !== b.muscle) return a.muscle.localeCompare(b.muscle);
    return a.rank - b.rank;
  });
}

/** 마지막 갱신 시각 (Mock: 현재 시각 기준, 1시간 단위로 내림) */
export function getLastUpdatedAt(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const h = String(now.getHours()).padStart(2, '0');
  const m = '00';
  return `${now.getMonth() + 1}/${now.getDate()} ${h}:${m}`;
}
