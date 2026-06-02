// olympicStore.ts — in-memory store for Machine Olympic feature

export interface OlympicVote {
  id: string;
  machineId: string;
  opponentId: string;
  bodyPart: string;
  round: '128강' | '64강' | '32강' | '16강' | '8강' | '4강' | '결승';
  gymId: string | null;
  createdAt: string;
}

export interface OlympicRank {
  machineId: string;
  machineName: string;
  machineBrand: string;
  bodyPart: string;
  winCount: number;
  loseCount: number;
  winRate: number;     // 0–100
}

// ── In-memory storage ──────────────────────────────────────────

let votes: OlympicVote[] = [
  // CHEST votes
  { id: 'v01', machineId: 'cybex_chest_1',   opponentId: 'hammer_chest_2', bodyPart: 'Chest', round: '8강', gymId: 'g01', createdAt: '2026-03-01T10:00:00Z' },
  { id: 'v02', machineId: 'cybex_chest_1',   opponentId: 'life_fitness_chest_1', bodyPart: 'Chest', round: '4강', gymId: 'g01', createdAt: '2026-03-01T10:01:00Z' },
  { id: 'v03', machineId: 'hammer_chest_2',  opponentId: 'precor_chest_1', bodyPart: 'Chest', round: '8강', gymId: 'g01', createdAt: '2026-03-02T09:00:00Z' },
  { id: 'v04', machineId: 'life_fitness_chest_1', opponentId: 'cybex_chest_1', bodyPart: 'Chest', round: '결승', gymId: 'g01', createdAt: '2026-03-02T09:30:00Z' },
  { id: 'v05', machineId: 'precor_chest_1',  opponentId: 'life_fitness_chest_1', bodyPart: 'Chest', round: '8강', gymId: 'g02', createdAt: '2026-03-03T11:00:00Z' },

  // BACK votes
  { id: 'v06', machineId: 'arsenal_back_1',  opponentId: 'body_master_back_1', bodyPart: 'Back', round: '8강', gymId: 'g01', createdAt: '2026-03-04T08:00:00Z' },
  { id: 'v07', machineId: 'arsenal_back_1',  opponentId: 'arsenal_back_3',     bodyPart: 'Back', round: '4강', gymId: 'g01', createdAt: '2026-03-04T08:05:00Z' },
  { id: 'v08', machineId: 'arsenal_back_3',  opponentId: 'body_master_back_2', bodyPart: 'Back', round: '8강', gymId: null,   createdAt: '2026-03-04T09:00:00Z' },
  { id: 'v09', machineId: 'body_master_back_1', opponentId: 'arsenal_back_3',  bodyPart: 'Back', round: '결승', gymId: 'g02', createdAt: '2026-03-05T10:00:00Z' },
  { id: 'v10', machineId: 'body_master_back_2', opponentId: 'arsenal_back_1',  bodyPart: 'Back', round: '8강', gymId: 'g02', createdAt: '2026-03-05T10:10:00Z' },

  // LEGS votes
  { id: 'v11', machineId: 'atlantis_leg_1',  opponentId: 'gym80_leg_14',    bodyPart: 'Leg', round: '8강', gymId: 'g01', createdAt: '2026-03-06T07:00:00Z' },
  { id: 'v12', machineId: 'atlantis_leg_1',  opponentId: 'gymleco_leg_4',   bodyPart: 'Leg', round: '4강', gymId: 'g01', createdAt: '2026-03-06T07:10:00Z' },
  { id: 'v13', machineId: 'gym80_leg_14',    opponentId: 'atlantis_leg_12', bodyPart: 'Leg', round: '8강', gymId: 'g01', createdAt: '2026-03-06T08:00:00Z' },
  { id: 'v14', machineId: 'atlantis_leg_12', opponentId: 'atlantis_leg_1',  bodyPart: 'Leg', round: '결승', gymId: null,   createdAt: '2026-03-07T09:00:00Z' },
  { id: 'v15', machineId: 'gymleco_leg_4',   opponentId: 'dynamic_leg_6',   bodyPart: 'Leg', round: '8강', gymId: 'g02', createdAt: '2026-03-07T09:30:00Z' },

  // ARMS votes
  { id: 'v16', machineId: 'cybex_arm_10',    opponentId: 'cybex_arm_11',    bodyPart: 'Arms', round: '8강', gymId: 'g01', createdAt: '2026-03-08T10:00:00Z' },
  { id: 'v17', machineId: 'cybex_arm_11',    opponentId: 'cybex_arm_1',     bodyPart: 'Arms', round: '4강', gymId: 'g01', createdAt: '2026-03-08T10:10:00Z' },
  { id: 'v18', machineId: 'icarian_arm_1',   opponentId: 'cybex_arm_10',    bodyPart: 'Arms', round: '8강', gymId: null,   createdAt: '2026-03-08T11:00:00Z' },
  { id: 'v19', machineId: 'cybex_arm_1',     opponentId: 'icarian_arm_1',   bodyPart: 'Arms', round: '결승', gymId: 'g02', createdAt: '2026-03-09T09:00:00Z' },
  { id: 'v20', machineId: 'body_master_arm_1', opponentId: 'cybex_arm_14',  bodyPart: 'Arms', round: '8강', gymId: 'g02', createdAt: '2026-03-09T09:30:00Z' },
];

// ── Functions ──────────────────────────────────────────────────

export function saveVote(vote: OlympicVote): void {
  votes = [vote, ...votes];
}

export function getVotes(): OlympicVote[] {
  return [...votes];
}

export function clearVotes(): void {
  votes = [];
}

/**
 * Build rankings for a body part from all votes.
 * A vote means machineId beat opponentId → win for machineId, loss for opponentId.
 */
export function getRankings(bodyPart: string): OlympicRank[] {
  // Collect all machine IDs that appear in this body part's votes
  const filtered = votes.filter((v) => v.bodyPart === bodyPart);

  const stats: Record<string, { wins: number; losses: number; name: string; brand: string }> = {};

  function ensure(id: string) {
    if (!stats[id]) stats[id] = { wins: 0, losses: 0, name: id, brand: '' };
  }

  for (const v of filtered) {
    ensure(v.machineId);
    ensure(v.opponentId);
    stats[v.machineId].wins += 1;
    stats[v.opponentId].losses += 1;
  }

  return Object.entries(stats)
    .map(([machineId, s]) => {
      const total = s.wins + s.losses;
      return {
        machineId,
        machineName: s.name,
        machineBrand: s.brand,
        bodyPart,
        winCount: s.wins,
        loseCount: s.losses,
        winRate: total > 0 ? Math.round((s.wins / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.winCount - a.winCount);
}

export function getMachineRecord(machineId: string): { wins: number; losses: number; winRate: number } {
  const wins   = votes.filter((v) => v.machineId === machineId).length;
  const losses = votes.filter((v) => v.opponentId === machineId).length;
  const total  = wins + losses;
  return { wins, losses, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
}
