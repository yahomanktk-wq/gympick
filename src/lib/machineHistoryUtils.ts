import { WorkoutLog } from '../data/types';

export interface MachineHistoryPoint {
  date:        string;
  fullDate:    string;
  maxWeight:   number;
  totalVolume: number;
  totalSets:   number;
  avgReps:     number;
}

export interface MachineHistorySummary {
  totalSessions: number;
  allTimePR:     number;
  avgVolume:     number;
  totalSets:     number;
  recentTrend:   'up' | 'down' | 'same';
}

export function getMachineHistoryPoints(
  sessions: WorkoutLog[],
  machineId: string,
  startDate?: Date,
  endDate?: Date,
): MachineHistoryPoint[] {
  const filtered = sessions
    .filter(s => {
      const machine = s.machines.find(m => m.machineId === machineId);
      if (!machine) return false;
      const d = new Date(s.date);
      if (startDate && d < startDate) return false;
      if (endDate   && d > endDate)   return false;
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return filtered.map(s => {
    const m = s.machines.find(m => m.machineId === machineId)!;
    const d = new Date(s.date);
    return {
      date:        `${d.getMonth() + 1}/${d.getDate()}`,
      fullDate:    s.date,
      maxWeight:   m.weight,
      totalVolume: m.weight * m.reps * m.sets,
      totalSets:   m.sets,
      avgReps:     m.reps,
    };
  });
}

export function getMachineHistorySummary(
  points: MachineHistoryPoint[],
): MachineHistorySummary {
  if (points.length === 0) {
    return { totalSessions: 0, allTimePR: 0, avgVolume: 0, totalSets: 0, recentTrend: 'same' };
  }

  const allTimePR = Math.max(...points.map(p => p.maxWeight));
  const avgVolume = Math.round(points.reduce((a, p) => a + p.totalVolume, 0) / points.length);
  const totalSets = points.reduce((a, p) => a + p.totalSets, 0);

  let recentTrend: 'up' | 'down' | 'same' = 'same';
  if (points.length >= 2) {
    const last     = points[points.length - 1].maxWeight;
    const prevLast = points[points.length - 2].maxWeight;
    if (last > prevLast)      recentTrend = 'up';
    else if (last < prevLast) recentTrend = 'down';
  }

  return { totalSessions: points.length, allTimePR, avgVolume, totalSets, recentTrend };
}

export function getDateRange(
  filter: PeriodFilter,
  customStart?: Date,
  customEnd?: Date,
): { start: Date; end: Date } {
  const end   = customEnd ?? new Date();
  const start = new Date(end);

  switch (filter) {
    case '1주':    start.setDate(end.getDate() - 7);   break;
    case '1개월':  start.setMonth(end.getMonth() - 1); break;
    case '3개월':  start.setMonth(end.getMonth() - 3); break;
    case '전체':   start.setFullYear(2000);             break;
    case '직접설정': return { start: customStart ?? start, end };
  }
  return { start, end };
}

export type PeriodFilter = '1주' | '1개월' | '3개월' | '전체' | '직접설정';
export const PERIOD_FILTERS: PeriodFilter[] = ['1주', '1개월', '3개월', '전체', '직접설정'];
