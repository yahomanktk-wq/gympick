import { MachineLevelData } from './types';

// ── Mock 초기 데이터 (10개 머신, 다양한 레벨) ───────────────────────────────

export const MOCK_MACHINE_LEVELS: MachineLevelData[] = [
  {
    machineId:        'arsenal_back_1',
    level:            8,
    currentXP:        140,
    totalXP:          1040,
    lastUsedAt:       '2026-04-14T09:00:00Z',
    weeklyUsageCount: 3,
  },
  {
    machineId:        'cybex_arm_11',
    level:            15,
    currentXP:        200,
    totalXP:          4800,
    lastUsedAt:       '2026-04-13T10:30:00Z',
    weeklyUsageCount: 2,
  },
  {
    machineId:        'life_fitness_leg_1',
    level:            32,
    currentXP:        500,
    totalXP:          28000,
    lastUsedAt:       '2026-04-14T08:00:00Z',
    weeklyUsageCount: 4,
  },
  {
    machineId:        'hammer_strength_chest_1',
    level:            65,
    currentXP:        1200,
    totalXP:          120000,
    lastUsedAt:       '2026-04-14T07:30:00Z',
    weeklyUsageCount: 5,
  },
  {
    machineId:        'atlantis_leg_1',
    level:            3,
    currentXP:        80,
    totalXP:          380,
    lastUsedAt:       '2026-04-12T15:00:00Z',
    weeklyUsageCount: 1,
  },
  {
    machineId:        'precor_shoulder_5',
    level:            22,
    currentXP:        620,
    totalXP:          12500,
    lastUsedAt:       '2026-04-13T11:00:00Z',
    weeklyUsageCount: 3,
  },
  {
    machineId:        'cybex_arm_10',
    level:            11,
    currentXP:        100,
    totalXP:          3200,
    lastUsedAt:       '2026-04-11T09:00:00Z',
    weeklyUsageCount: 2,
  },
  {
    machineId:        'gym80_leg_14',
    level:            45,
    currentXP:        2100,
    totalXP:          65000,
    lastUsedAt:       '2026-04-14T06:00:00Z',
    weeklyUsageCount: 4,
  },
  {
    machineId:        'star_trac_back_1',
    level:            1,
    currentXP:        40,
    totalXP:          40,
    lastUsedAt:       '2026-04-10T14:00:00Z',
    weeklyUsageCount: 1,
  },
  {
    machineId:        'panatta_leg_10',
    level:            58,
    currentXP:        3000,
    totalXP:          98000,
    lastUsedAt:       '2026-04-14T08:45:00Z',
    weeklyUsageCount: 5,
  },
];

// ── 인메모리 스토어 ───────────────────────────────────────────────────────────

const store = new Map<string, MachineLevelData>(
  MOCK_MACHINE_LEVELS.map(d => [d.machineId, d]),
);

/** 특정 머신의 레벨 데이터 조회 */
export function getMachineLevelData(machineId: string): MachineLevelData | null {
  return store.get(machineId) ?? null;
}

/** 레벨 데이터 업데이트 (로컬 상태) */
export function updateMachineLevelData(data: MachineLevelData): void {
  store.set(data.machineId, data);
}
