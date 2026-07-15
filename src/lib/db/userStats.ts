import { supabase } from '../supabase';

const TREND_DAYS = 14;
const ACTIVE_WINDOW_DAYS = 7;

export interface UserOverviewStats {
  totalUsers:     number;
  roleBreakdown:  { user: number; manager: number; admin: number };
  signupTrend:    { date: string; count: number }[]; // oldest → newest, TREND_DAYS entries
  // profiles 테이블에 실제 로그인 시각 컬럼(last_sign_in_at 등)이 없어
  // updated_at 기준 근사치임 — UI에서 반드시 근사치임을 명시해야 함.
  recentlyActiveApprox: number;
}

const EMPTY_STATS: UserOverviewStats = {
  totalUsers: 0,
  roleBreakdown: { user: 0, manager: 0, admin: 0 },
  signupTrend: [],
  recentlyActiveApprox: 0,
};

// 어드민: 유저 현황 통계 (전체 가입자 수 / 역할별 분포 / 신규가입 추이 / 활동 근사치)
export async function fetchUserOverviewStats(): Promise<UserOverviewStats> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, created_at, updated_at');
    if (error || !data) {
      if (__DEV__ && error) console.warn('[db/userStats] fetchUserOverviewStats error:', error.message);
      return EMPTY_STATS;
    }

    const roleBreakdown = { user: 0, manager: 0, admin: 0 };
    data.forEach((r: any) => {
      const role = (r.role ?? 'user') as 'user' | 'manager' | 'admin';
      if (role in roleBreakdown) roleBreakdown[role]++;
    });

    const dayBuckets = new Map<string, number>();
    const today = new Date();
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dayBuckets.set(d.toISOString().slice(0, 10), 0);
    }
    data.forEach((r: any) => {
      if (!r.created_at) return;
      const key = String(r.created_at).slice(0, 10);
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    });
    const signupTrend = Array.from(dayBuckets.entries()).map(([date, count]) => ({ date, count }));

    const activeSince = new Date(today);
    activeSince.setDate(activeSince.getDate() - ACTIVE_WINDOW_DAYS);
    const recentlyActiveApprox = data.filter((r: any) => r.updated_at && new Date(r.updated_at) >= activeSince).length;

    return {
      totalUsers: data.length,
      roleBreakdown,
      signupTrend,
      recentlyActiveApprox,
    };
  } catch (e: any) {
    if (__DEV__) console.warn('[db/userStats] fetchUserOverviewStats exception:', e?.message);
    return EMPTY_STATS;
  }
}
