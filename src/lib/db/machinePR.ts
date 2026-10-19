import { supabase } from '../supabase';
import { epley1RM, round1 } from '../oneRepMax';

// 2026-10-19 (F3-1): 머신 상세 '내 PR' — 이 머신에서 내가 기록한 세트 중 Epley 추정 1RM 최고값.
// 매니저는 RLS상 자기 헬스장 다른 회원의 기록도 읽을 수 있으므로, 반드시
// workout_sessions.user_id = 현재 유저로 명시 필터한다.

export interface MachinePR {
  oneRepMax: number;      // rounded to 0.1
  weight:    number;
  reps:      number;
  date:      string;      // session date ISO
  gymId:     string | null;
  gymName:   string | null;
}

// 다대일 임베드는 보통 객체로 오지만, 배열로 오는 경우도 대비
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** 내 이 머신 최고 추정 1RM. 기록 없음 → null. 실패 → null. */
export async function fetchMyMachinePR(userId: string, machineId: string): Promise<MachinePR | null> {
  try {
    const { data, error } = await supabase
      .from('workout_sets')
      .select('weight, reps, workout_entries!inner(machine_id, workout_sessions!inner(user_id, date, gym_id))')
      .eq('workout_entries.machine_id', machineId)
      .eq('workout_entries.workout_sessions.user_id', userId);
    if (error) throw error;

    let best: { orm: number; weight: number; reps: number; date: string; gymId: string | null } | null = null;
    for (const row of (data ?? []) as any[]) {
      const entry   = one<any>(row.workout_entries);
      const session = one<any>(entry?.workout_sessions);
      // 임베드 필터가 적용되지 않는 경우까지 대비해 클라이언트에서도 한 번 더 확인
      if (!entry || !session || entry.machine_id !== machineId || session.user_id !== userId) continue;

      const weight = Number(row.weight);
      const reps   = Number(row.reps);
      const orm    = epley1RM(weight, reps);
      if (orm === null) continue;

      const date: string = session.date;
      if (
        !best ||
        orm > best.orm ||
        // 동률이면 먼저 달성한 날짜
        (orm === best.orm && new Date(date).getTime() < new Date(best.date).getTime())
      ) {
        best = { orm, weight, reps, date, gymId: session.gym_id ?? null };
      }
    }
    if (!best) return null;

    let gymName: string | null = null;
    if (best.gymId) {
      const { data: gym } = await supabase
        .from('gyms')
        .select('name')
        .eq('id', best.gymId)
        .maybeSingle();
      gymName = (gym?.name as string | undefined) ?? null;
    }

    return {
      oneRepMax: round1(best.orm),
      weight:    best.weight,
      reps:      best.reps,
      date:      best.date,
      gymId:     best.gymId,
      gymName,
    };
  } catch (e) {
    if (__DEV__) console.warn('[machinePR] fetchMyMachinePR 오류:', e);
    return null;
  }
}
