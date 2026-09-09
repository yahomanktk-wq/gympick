import { supabase } from '../supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WeeklyRankingEntry {
  machineId:    string;
  machineName:  string;
  machineBrand: string;
  targetMuscle: string;
  setCount:     number;
  gymCount:     number;
  score:        number;
  rank:         number;
}

export interface FavoriteRankingEntry {
  machineId:     string;
  machineName:   string;
  machineBrand:  string;
  targetMuscle:  string;
  favoriteCount: number;
  rank:          number;
}

export interface GymRankingEntry {
  gymId:         string;
  gymName:       string;
  location:      string;
  favoriteCount: number;
  reviewCount:   number;
  totalScore:    number;
  rank:          number;
}

export interface RankingTabData {
  weekly:      WeeklyRankingEntry[];
  weeklyTotal: number;
  favorites:   FavoriteRankingEntry[];
  gyms:        GymRankingEntry[];
  updatedAt:   string;
}

// ── Fetch ──────────────────────────────────────────────────────────────────

export async function fetchRankingTabData(): Promise<RankingTabData> {
  const updatedAt = new Date().toISOString();

  const [weeklyRes, favRes, gymRes] = await Promise.allSettled([
    supabase.from('machine_weekly_ranking').select('*'),
    supabase.from('machine_favorite_ranking').select('*'),
    supabase.from('gym_popularity_ranking').select('*'),
  ]);

  // Weekly
  const weeklyRaw = weeklyRes.status === 'fulfilled' && !weeklyRes.value.error
    ? (weeklyRes.value.data ?? [])
    : [];
  const weekly: WeeklyRankingEntry[] = (weeklyRaw as any[]).map((row, idx) => ({
    machineId:    row.machine_id    ?? '',
    machineName:  row.machine_name  ?? '',
    machineBrand: row.machine_brand ?? '',
    targetMuscle: (row.target_muscle ?? 'OTHER').toUpperCase(),
    setCount:     Number(row.set_count)  || 0,
    gymCount:     Number(row.gym_count)  || 0,
    score:        Number(row.score)      || 0,
    rank:         idx + 1,
  }));
  const weeklyTotal = weekly.reduce((s, e) => s + e.setCount, 0);

  // Favorites
  const favRaw = favRes.status === 'fulfilled' && !favRes.value.error
    ? (favRes.value.data ?? [])
    : [];
  const favorites: FavoriteRankingEntry[] = (favRaw as any[]).map((row, idx) => ({
    machineId:     row.machine_id     ?? '',
    machineName:   row.machine_name   ?? '',
    machineBrand:  row.machine_brand  ?? '',
    targetMuscle:  (row.target_muscle ?? 'OTHER').toUpperCase(),
    favoriteCount: Number(row.favorite_count) || 0,
    rank:          idx + 1,
  }));

  // Gyms
  const gymRaw = gymRes.status === 'fulfilled' && !gymRes.value.error
    ? (gymRes.value.data ?? [])
    : [];
  const gyms: GymRankingEntry[] = (gymRaw as any[]).map((row, idx) => ({
    gymId:         row.gym_id    ?? '',
    gymName:       row.gym_name  ?? '',
    location:      row.location  ?? '',
    favoriteCount: Number(row.favorite_count) || 0,
    reviewCount:   Number(row.review_count)   || 0,
    totalScore:    Number(row.total_score)    || 0,
    rank:          idx + 1,
  }));

  return { weekly, weeklyTotal, favorites, gyms, updatedAt };
}

// ── 인기 머신 (전체 기간 가중치 합산 점수) ────────────────────────────────────
// 2026-09-09: 홈 화면 '인기 머신' 섹션의 선정 기준을 "이번 주 세트 수" 대신
// "즐겨찾기 35% · 운동일지 작성 횟수 20% · 상세페이지 조회수 35% · 보유 헬스장 수 10%"
// 가중치 합산 점수로 변경. Supabase의 machine_popularity_ranking 뷰(신규, 기존
// machine_weekly_ranking과는 별개 — 그대로 남아있음)에서 이미 계산된 score를 가져온다.
// 뷰 정의는 claude/인기머신-랭킹기준-변경-2026-09-09.sql 참고 (Supabase SQL Editor에서 직접 실행 필요).

export interface PopularityRankingEntry {
  machineId:     string;
  machineName:   string;
  machineBrand:  string;
  targetMuscle:  string;
  favoriteCount: number;
  logCount:      number;
  viewCount:     number;
  gymCount:      number;
  score:         number;
  rank:          number;
}

export async function fetchMachinePopularityRanking(): Promise<PopularityRankingEntry[]> {
  const { data, error } = await supabase
    .from('machine_popularity_ranking')
    .select('*')
    .order('score', { ascending: false });

  if (error || !data) {
    if (__DEV__) console.warn('[rankingQueries] fetchMachinePopularityRanking error:', error?.message);
    return [];
  }

  return (data as any[]).map((row, idx) => ({
    machineId:     row.machine_id     ?? '',
    machineName:   row.machine_name   ?? '',
    machineBrand:  row.machine_brand  ?? '',
    targetMuscle:  (row.target_muscle ?? 'OTHER').toUpperCase(),
    favoriteCount: Number(row.favorite_count) || 0,
    logCount:      Number(row.log_count)      || 0,
    viewCount:     Number(row.view_count)     || 0,
    gymCount:      Number(row.gym_count)      || 0,
    score:         Number(row.score)          || 0,
    rank:          idx + 1,
  }));
}

export type { OlympicRankingEntry } from './olympicRankings';
