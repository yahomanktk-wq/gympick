import { supabase } from '../supabase';
import {
  kstAddDays,
  kstDayStartUtcIso,
  kstDayEndExclusiveUtcIso,
  kstDateKey,
  kstHourAndWeekday,
  kstMonthRanges,
} from '../kstDate';

export type PeriodType = 'week' | 'month' | 'custom';

export interface MachineStat {
  machineId:    string;
  machineName:  string;
  machineBrand: string;
  targetMuscle: string;
  usageCount:   number;
}

export interface DailyUsage {
  date:  string;  // 'YYYY-MM-DD'
  count: number;
}

export async function fetchMachineUsageStats(
  gymId:     string,
  startDate: string,
  endDate:   string,
): Promise<MachineStat[]> {
  try {
    const { data, error } = await supabase
      .from('workout_entries')
      .select(`
        machine_id,
        machine_name,
        machine_brand,
        target_muscle,
        workout_sessions!inner(gym_id, date)
      `)
      .eq('workout_sessions.gym_id', gymId)
      .gte('workout_sessions.date', kstDayStartUtcIso(startDate))
      .lt('workout_sessions.date', kstDayEndExclusiveUtcIso(endDate));

    if (error || !data) {
      if (__DEV__) console.warn('[gymStats] fetchMachineUsageStats error:', error?.message);
      return [];
    }

    const map: Record<string, MachineStat> = {};
    for (const row of data) {
      const id = row.machine_id;
      if (!map[id]) {
        map[id] = {
          machineId:    id,
          machineName:  row.machine_name,
          machineBrand: row.machine_brand,
          targetMuscle: row.target_muscle,
          usageCount:   0,
        };
      }
      map[id].usageCount += 1;
    }

    return Object.values(map).sort((a, b) => b.usageCount - a.usageCount);
  } catch (e) {
    if (__DEV__) console.warn('[gymStats] fetchMachineUsageStats exception:', e);
    return [];
  }
}

export async function fetchDailyUsageStats(
  gymId:     string,
  startDate: string,
  endDate:   string,
): Promise<DailyUsage[]> {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('gym_id', gymId)
      .gte('date', kstDayStartUtcIso(startDate))
      .lt('date', kstDayEndExclusiveUtcIso(endDate));

    if (error || !data) return [];

    const map: Record<string, number> = {};
    for (const row of data) {
      const dateKey = kstDateKey(row.date);
      map[dateKey] = (map[dateKey] ?? 0) + 1;
    }

    const result: DailyUsage[] = [];
    for (let key = startDate; key <= endDate; key = kstAddDays(key, 1)) {
      result.push({ date: key, count: map[key] ?? 0 });
    }
    return result;
  } catch (e) {
    if (__DEV__) console.warn('[gymStats] fetchDailyUsageStats exception:', e);
    return [];
  }
}

export async function fetchTopMachinesByMuscle(
  gymId:     string,
  startDate: string,
  endDate:   string,
): Promise<Record<string, MachineStat[]>> {
  const all = await fetchMachineUsageStats(gymId, startDate, endDate);

  const byMuscle: Record<string, MachineStat[]> = {};
  for (const stat of all) {
    const muscle = stat.targetMuscle || 'Other';
    if (!byMuscle[muscle]) byMuscle[muscle] = [];
    if (byMuscle[muscle].length < 10) {
      byMuscle[muscle].push(stat);
    }
  }
  return byMuscle;
}

export interface PeakTimeStats {
  byHour:      Record<number, number>;
  byDayOfWeek: Record<number, number>;
  /** [weekday 0=일..6=토][hour 0..23] 세션 수 (KST) — 요일×시간 히트맵용 (F5-3) */
  grid:        number[][];
}

/** 7(요일) × 24(시간) 0으로 채운 그리드 */
export function emptyPeakGrid(): number[][] {
  return Array.from({ length: 7 }, () => new Array(24).fill(0));
}

export interface MachineAvgStats {
  machineId:    string;
  machineName:  string;
  machineBrand: string;
  targetMuscle: string;
  avgSets:      number;
  avgWeight:    number;
  usageCount:   number;
}

export async function fetchPeakTimeStats(
  gymId:     string,
  startDate: string,
  endDate:   string,
): Promise<PeakTimeStats> {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('gym_id', gymId)
      .gte('date', kstDayStartUtcIso(startDate))
      .lt('date', kstDayEndExclusiveUtcIso(endDate));

    if (error || !data) return { byHour: {}, byDayOfWeek: {}, grid: emptyPeakGrid() };

    const byHour:      Record<number, number> = {};
    const byDayOfWeek: Record<number, number> = {};
    const grid = emptyPeakGrid();

    for (const row of data) {
      const { hour: h, weekday: dow } = kstHourAndWeekday(row.date);
      byHour[h]        = (byHour[h]        ?? 0) + 1;
      byDayOfWeek[dow] = (byDayOfWeek[dow] ?? 0) + 1;
      grid[dow][h] += 1;
    }

    return { byHour, byDayOfWeek, grid };
  } catch (e) {
    if (__DEV__) console.warn('[gymStats] fetchPeakTimeStats:', e);
    return { byHour: {}, byDayOfWeek: {}, grid: emptyPeakGrid() };
  }
}

/** 헬스장 보유 머신 ID 목록 (통계용 — mock 폴백 없음, 실패 시 null) */
export async function fetchOwnedMachineIds(gymId: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from('gym_machines')
      .select('machine_id')
      .eq('gym_id', gymId);

    if (error || !data) return null;
    return data.map(r => r.machine_id as string);
  } catch (e) {
    if (__DEV__) console.warn('[gymStats] fetchOwnedMachineIds:', e);
    return null;
  }
}

export async function fetchMachineActivationRate(
  gymId:           string,
  ownedMachineIds: string[],
  startDate:       string,
  endDate:         string,
): Promise<{ activatedCount: number; totalCount: number; rate: number }> {
  const totalCount = ownedMachineIds.length;
  try {
    const { data, error } = await supabase
      .from('workout_entries')
      .select('machine_id, workout_sessions!inner(gym_id, date)')
      .eq('workout_sessions.gym_id', gymId)
      .gte('workout_sessions.date', kstDayStartUtcIso(startDate))
      .lt('workout_sessions.date', kstDayEndExclusiveUtcIso(endDate));

    if (error || !data) return { activatedCount: 0, totalCount, rate: 0 };

    const owned          = new Set(ownedMachineIds);
    const usedOwned      = new Set(data.map(r => r.machine_id).filter(id => owned.has(id)));
    const activatedCount = usedOwned.size;
    const rate           = totalCount > 0 ? Math.round((activatedCount / totalCount) * 100) : 0;

    return { activatedCount, totalCount, rate };
  } catch (e) {
    if (__DEV__) console.warn('[gymStats] fetchMachineActivationRate:', e);
    return { activatedCount: 0, totalCount, rate: 0 };
  }
}

/**
 * 기간 내 이 헬스장 회원 수 (F5-2) — workout_sessions의 고유 user_id 수.
 * 다른 통계와 같은 KST 범위 헬퍼를 사용. 오류 시 0.
 */
export async function fetchMemberCount(
  gymId:     string,
  startDate: string,
  endDate:   string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('user_id')
      .eq('gym_id', gymId)
      .gte('date', kstDayStartUtcIso(startDate))
      .lt('date', kstDayEndExclusiveUtcIso(endDate));

    if (error || !data) return 0;
    return new Set(data.map(r => r.user_id)).size;
  } catch (e) {
    if (__DEV__) console.warn('[gymStats] fetchMemberCount exception:', e);
    return 0;
  }
}

export async function fetchRetentionStats(
  gymId: string,
): Promise<{ thisMonth: number; lastMonth: number; retentionRate: number | null; failed: boolean }> {
  try {
    const { thisStart, thisEnd, lastStart, lastEnd } = kstMonthRanges();

    const [thisData, lastData] = await Promise.all([
      supabase.from('workout_sessions').select('user_id').eq('gym_id', gymId)
        .gte('date', kstDayStartUtcIso(thisStart)).lt('date', kstDayEndExclusiveUtcIso(thisEnd)),
      supabase.from('workout_sessions').select('user_id').eq('gym_id', gymId)
        .gte('date', kstDayStartUtcIso(lastStart)).lt('date', kstDayEndExclusiveUtcIso(lastEnd)),
    ]);

    if (thisData.error || lastData.error) {
      return { thisMonth: 0, lastMonth: 0, retentionRate: null, failed: true };
    }

    const thisUsers = new Set((thisData.data ?? []).map(r => r.user_id));
    const lastUsers = new Set((lastData.data ?? []).map(r => r.user_id));

    let returnedCount = 0;
    for (const uid of lastUsers) {
      if (thisUsers.has(uid)) returnedCount++;
    }

    const retentionRate = lastUsers.size > 0
      ? Math.round((returnedCount / lastUsers.size) * 100)
      : null;

    return { thisMonth: thisUsers.size, lastMonth: lastUsers.size, retentionRate, failed: false };
  } catch (e) {
    if (__DEV__) console.warn('[gymStats] fetchRetentionStats:', e);
    return { thisMonth: 0, lastMonth: 0, retentionRate: null, failed: true };
  }
}

export async function fetchMachineAvgStats(
  gymId:     string,
  startDate: string,
  endDate:   string,
): Promise<MachineAvgStats[]> {
  try {
    const { data, error } = await supabase
      .from('workout_entries')
      .select(`
        machine_id,
        machine_name,
        machine_brand,
        target_muscle,
        workout_sessions!inner(gym_id, date),
        workout_sets(weight, reps)
      `)
      .eq('workout_sessions.gym_id', gymId)
      .gte('workout_sessions.date', kstDayStartUtcIso(startDate))
      .lt('workout_sessions.date', kstDayEndExclusiveUtcIso(endDate));

    if (error || !data) return [];

    const map: Record<string, {
      machineName:  string;
      machineBrand: string;
      targetMuscle: string;
      totalSets:    number;
      totalWeight:  number;
      setCount:     number;
      entryCount:   number;
    }> = {};

    for (const row of data) {
      const id = row.machine_id;
      if (!map[id]) {
        map[id] = {
          machineName:  row.machine_name,
          machineBrand: row.machine_brand,
          targetMuscle: row.target_muscle,
          totalSets:    0,
          totalWeight:  0,
          setCount:     0,
          entryCount:   0,
        };
      }
      const sets = (row.workout_sets ?? []) as { weight: number; reps: number }[];
      map[id].totalSets  += sets.length;
      map[id].entryCount += 1;
      for (const s of sets) {
        if (s.weight > 0) {
          map[id].totalWeight += s.weight;
          map[id].setCount    += 1;
        }
      }
    }

    return Object.entries(map).map(([machineId, v]) => ({
      machineId,
      machineName:  v.machineName,
      machineBrand: v.machineBrand,
      targetMuscle: v.targetMuscle,
      avgSets:      v.entryCount > 0 ? Math.round(v.totalSets  / v.entryCount * 10) / 10 : 0,
      avgWeight:    v.setCount   > 0 ? Math.round(v.totalWeight / v.setCount   * 10) / 10 : 0,
      usageCount:   v.entryCount,
    })).sort((a, b) => b.usageCount - a.usageCount);
  } catch (e) {
    if (__DEV__) console.warn('[gymStats] fetchMachineAvgStats:', e);
    return [];
  }
}

// 이번 주(월~일) 이 헬스장에서 운동 기록한 고유 유저 수
export async function fetchWeeklyVisitors(
  gymId:        string,
  weekStartISO: string,  // 'YYYY-MM-DD' (월요일)
  weekEndISO:   string,  // 'YYYY-MM-DD' (일요일)
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('user_id')
      .eq('gym_id', gymId)
      .gte('date', kstDayStartUtcIso(weekStartISO))
      .lt('date', kstDayEndExclusiveUtcIso(weekEndISO));
    if (error || !data) return 0;
    return new Set(data.map((r: any) => r.user_id)).size;
  } catch {
    return 0;
  }
}
