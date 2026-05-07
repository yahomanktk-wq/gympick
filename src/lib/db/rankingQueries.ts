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
