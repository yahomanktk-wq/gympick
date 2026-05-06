import { supabase } from '../supabase';
import { MachineRankingEntry } from '../../data/types';
import { MOCK_MACHINE_RANKINGS } from '../../data/machineRankingStore';

export interface RankingEntry {
  machineId:    string;
  machineName:  string;
  machineBrand: string;
  targetMuscle: string;
  usageCount:   number;
  rank:         number;
}

export interface RankingResult {
  entries:    RankingEntry[];
  totalCount: number;
  updatedAt:  string;
}

export async function fetchWeeklyRankings(): Promise<RankingResult> {
  const updatedAt = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('machine_weekly_ranking')
      .select('machine_id, machine_name, machine_brand, target_muscle, usage_count');

    if (error) {
      if (__DEV__) console.warn('[rankings] Supabase error:', error.message);
      return { entries: [], totalCount: 0, updatedAt };
    }

    if (!data || data.length === 0) {
      return { entries: [], totalCount: 0, updatedAt };
    }

    const totalCount = data.reduce((sum, row) => sum + (Number(row.usage_count) || 0), 0);

    const muscleGroups = new Map<string, typeof data>();
    for (const row of data) {
      const muscle = (row.target_muscle ?? 'OTHER').toUpperCase();
      if (!muscleGroups.has(muscle)) muscleGroups.set(muscle, []);
      muscleGroups.get(muscle)!.push(row);
    }

    const entries: RankingEntry[] = [];
    for (const [muscle, rows] of muscleGroups.entries()) {
      rows.slice(0, 10).forEach((row, idx) => {
        entries.push({
          machineId:    row.machine_id    ?? '',
          machineName:  row.machine_name  ?? '',
          machineBrand: row.machine_brand ?? '',
          targetMuscle: muscle,
          usageCount:   Number(row.usage_count) || 0,
          rank:         idx + 1,
        });
      });
    }

    return { entries, totalCount, updatedAt };
  } catch (e) {
    if (__DEV__) console.warn('[rankings] unexpected error:', e);
    return { entries: [], totalCount: 0, updatedAt };
  }
}

interface UsageRow {
  machine_id:    string;
  machine_name:  string;
  machine_brand: string;
  target_muscle: string;
  usage_count:   number;
}

/**
 * 이번 주 머신 사용 횟수 기반 랭킹 계산
 * 데이터 없으면 Mock fallback 반환
 */
export async function fetchMachineRankings(): Promise<MachineRankingEntry[]> {
  try {
    const { data, error } = await supabase
      .from('machine_usage_stats')
      .select('machine_id, machine_name, machine_brand, target_muscle, usage_count')
      .order('usage_count', { ascending: false });

    if (error || !data?.length) {
      if (__DEV__ && error) console.warn('[rankings] fetch error, using mock:', error.message);
      return MOCK_MACHINE_RANKINGS;
    }

    // 부위별로 그룹핑 후 상위 3개씩 랭킹 부여
    const muscleGroups = new Map<string, UsageRow[]>();
    for (const row of data) {
      const muscle = (row.target_muscle ?? 'OTHER').toUpperCase();
      const group  = muscleGroups.get(muscle) ?? [];
      group.push(row);
      muscleGroups.set(muscle, group);
    }

    const rankings: MachineRankingEntry[] = [];
    for (const [muscle, rows] of muscleGroups.entries()) {
      const sorted = rows
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 3);

      sorted.forEach((row, idx) => {
        rankings.push({
          rank:        idx + 1,
          machineId:   row.machine_id,
          machineName: row.machine_name,
          brandName:   row.machine_brand,
          muscle,
          usageCount:  row.usage_count,
          usageChange: 'same',
        });
      });
    }

    return rankings.length > 0 ? rankings : MOCK_MACHINE_RANKINGS;
  } catch (err) {
    if (__DEV__) console.warn('[rankings] error, using mock:', err);
    return MOCK_MACHINE_RANKINGS;
  }
}

/**
 * 부위별 랭킹 조회
 */
export async function fetchRankingByMuscle(muscle: string): Promise<MachineRankingEntry[]> {
  const all = await fetchMachineRankings();
  return all
    .filter(e => e.muscle.toUpperCase() === muscle.toUpperCase())
    .sort((a, b) => a.rank - b.rank);
}

/**
 * 전체 랭킹 조회
 */
export async function fetchAllRankings(): Promise<MachineRankingEntry[]> {
  const all = await fetchMachineRankings();
  return [...all].sort((a, b) => {
    if (a.muscle !== b.muscle) return a.muscle.localeCompare(b.muscle);
    return a.rank - b.rank;
  });
}
