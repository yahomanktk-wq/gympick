import { WorkoutLog } from '../data/types';

// ── Weekly volume ─────────────────────────────────────────────────────────────

/** 주간 총 볼륨 계산 (무게 × 횟수 × 세트 합산), 최근 8주 반환 */
export function calcWeeklyVolume(logs: WorkoutLog[]): { weekLabel: string; volume: number }[] {
  if (!logs.length) return [];

  // Build a map: weekStart (Monday ISO) → total volume
  const weekMap = new Map<string, number>();

  for (const log of logs) {
    const d = new Date(log.date);
    // Shift to Monday
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);

    const vol = log.machines.reduce(
      (sum, m) => sum + m.weight * m.reps * m.sets,
      0,
    );
    weekMap.set(key, (weekMap.get(key) ?? 0) + vol);
  }

  // Sort keys descending, take up to 8 weeks
  const sorted = [...weekMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-8);

  return sorted.map(([iso, volume]) => {
    const d = new Date(iso);
    const weekLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    return { weekLabel, volume };
  });
}

// ── Machine weight history ─────────────────────────────────────────────────────

/** 머신별 최고 무게 추이 계산 */
export function calcMachineWeightHistory(
  logs: WorkoutLog[],
  machineId: string,
): { dateLabel: string; maxWeight: number }[] {
  const results: { dateLabel: string; maxWeight: number }[] = [];

  for (const log of logs) {
    const entry = log.machines.find(m => m.machineId === machineId);
    if (!entry) continue;
    const d = new Date(log.date);
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    results.push({ dateLabel, maxWeight: entry.weight });
  }

  // Sort chronologically and deduplicate by date (keep max)
  const dateMap = new Map<string, number>();
  for (const r of results) {
    dateMap.set(r.dateLabel, Math.max(dateMap.get(r.dateLabel) ?? 0, r.maxWeight));
  }

  return [...dateMap.entries()].map(([dateLabel, maxWeight]) => ({ dateLabel, maxWeight }));
}

// ── Muscle frequency ──────────────────────────────────────────────────────────

/** 부위별 운동 횟수 집계 */
export function calcMuscleFrequency(logs: WorkoutLog[]): { muscle: string; count: number }[] {
  const map = new Map<string, number>();

  for (const log of logs) {
    for (const m of log.machines) {
      const muscle = m.targetMuscle;
      map.set(muscle, (map.get(muscle) ?? 0) + 1);
    }
  }

  return [...map.entries()]
    .map(([muscle, count]) => ({ muscle, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Data sufficiency ──────────────────────────────────────────────────────────

/** 최소 7일치 데이터가 있어야 충분하다고 판단 */
export function hasEnoughData(logs: WorkoutLog[]): boolean {
  if (logs.length === 0) return false;
  const dates = new Set(logs.map(l => l.date.slice(0, 10)));
  return dates.size >= 7;
}

// ── Top machines ──────────────────────────────────────────────────────────────

/** 가장 많이 사용한 머신 top 5 */
export function calcTopMachines(logs: WorkoutLog[]): {
  machineId: string;
  machineName: string;
  usageCount: number;
}[] {
  const map = new Map<string, { machineName: string; usageCount: number }>();

  for (const log of logs) {
    for (const m of log.machines) {
      const existing = map.get(m.machineId);
      if (existing) {
        existing.usageCount += 1;
      } else {
        map.set(m.machineId, { machineName: m.machineName, usageCount: 1 });
      }
    }
  }

  return [...map.entries()]
    .map(([machineId, { machineName, usageCount }]) => ({ machineId, machineName, usageCount }))
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 5);
}

// ── Monthly summary ───────────────────────────────────────────────────────────

/** 이번 달 총 운동 횟수, 총 볼륨, 평균 세트 수 요약 */
export function calcMonthlySummary(logs: WorkoutLog[]): {
  totalSessions: number;
  totalVolume: number;
  avgSetsPerSession: number;
} {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  const thisMonth = logs.filter(l => {
    const d = new Date(l.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const totalSessions = thisMonth.length;

  const totalVolume = thisMonth.reduce(
    (sum, log) =>
      sum + log.machines.reduce((s, m) => s + m.weight * m.reps * m.sets, 0),
    0,
  );

  const totalSets = thisMonth.reduce(
    (sum, log) => sum + log.machines.reduce((s, m) => s + m.sets, 0),
    0,
  );

  const avgSetsPerSession = totalSessions > 0
    ? Math.round(totalSets / totalSessions)
    : 0;

  return { totalSessions, totalVolume, avgSetsPerSession };
}
