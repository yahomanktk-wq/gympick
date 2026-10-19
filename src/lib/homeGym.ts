import { supabase } from './supabase';

// 2026-10-19 (F2-1): '내 헬스장'(홈짐) 결정 모듈.
// 규칙:
//   1. profiles.home_gym_id(사용자가 직접 지정한 값)가 있으면 그 헬스장.
//   2. 없으면 최근 30일 운동일지(workout_sessions.gym_id)에서 가장 많이 선택한
//      헬스장. 횟수가 같으면 그중 가장 최근 세션의 헬스장.
//   3. 30일 내 세션도, 수동 지정도 없으면 null.
// 30일은 "지금으로부터 30×24시간"의 롤링 윈도우라 KST 날짜 경계 정렬은 하지 않는다.

export interface HomeGym {
  gymId:   string;
  gymName: string;
  source:  'manual' | 'auto';
}

/**
 * 30일 최빈 헬스장 계산 (순수 함수 — 테스트 가능하도록 분리). sessions: {gymId, date ISO}
 *
 * 기대 결과:
 *   [A, A, B]              → A    (최빈)
 *   [A, B] (B가 더 최근)    → B    (동률 → 최근)
 *   [null, null]           → null (gymId 없는 세션은 무시)
 *   []                     → null
 */
export function pickMostFrequentGym(
  sessions: { gymId: string | null; date: string }[],
): string | null {
  const stats = new Map<string, { count: number; latest: number }>();
  for (const s of sessions) {
    if (!s.gymId) continue;
    const t = new Date(s.date).getTime();
    const prev = stats.get(s.gymId);
    if (prev) {
      prev.count += 1;
      if (t > prev.latest) prev.latest = t;
    } else {
      stats.set(s.gymId, { count: 1, latest: t });
    }
  }

  let best: string | null = null;
  let bestCount = 0;
  let bestLatest = -Infinity;
  for (const [gymId, { count, latest }] of Array.from(stats.entries())) {
    if (count > bestCount || (count === bestCount && latest > bestLatest)) {
      best = gymId;
      bestCount = count;
      bestLatest = latest;
    }
  }
  return best;
}

async function fetchGymName(gymId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('gyms')
    .select('id, name')
    .eq('id', gymId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.name as string) : null;
}

/** 홈짐 결정: 수동값 우선 → 30일 최빈(동률이면 최근) → null. 실패 시 null. */
export async function resolveHomeGym(userId: string): Promise<HomeGym | null> {
  try {
    // 1. 수동 지정값
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('home_gym_id')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) throw profileError;

    const manualId: string | null = profile?.home_gym_id ?? null;
    if (manualId) {
      const name = await fetchGymName(manualId);
      if (name !== null) return { gymId: manualId, gymName: name, source: 'manual' };
      // 지정된 헬스장이 없어졌으면 자동 계산으로 넘어간다
    }

    // 2. 최근 30일 최빈 헬스장
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('gym_id, date')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .not('gym_id', 'is', null);
    if (sessionsError) throw sessionsError;

    const autoId = pickMostFrequentGym(
      (rows ?? []).map((r: any) => ({ gymId: r.gym_id ?? null, date: r.date })),
    );
    if (!autoId) return null;

    const name = await fetchGymName(autoId);
    if (name === null) return null;
    return { gymId: autoId, gymName: name, source: 'auto' };
  } catch (e) {
    if (__DEV__) console.warn('[homeGym] resolveHomeGym 오류:', e);
    return null;
  }
}

/** 수동 지정/해제 (null이면 자동으로 복귀). 실패 시 throw. */
export async function setManualHomeGym(userId: string, gymId: string | null): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ home_gym_id: gymId })
    .eq('id', userId);
  if (error) {
    if (__DEV__) console.warn('[homeGym] setManualHomeGym 오류:', error.message);
    throw error;
  }
}
