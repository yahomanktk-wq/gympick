import { supabase } from '../supabase';

// 2026-10-19 (F3-3): 헬스장 × 머신 랭킹 (추정 1RM, Epley — 서버 함수에서 계산).
// get_gym_machine_ranking(p_gym_id, p_machine_id) — 로그인 유저 전용 RPC.
//   잠금(3명 미만):   { locked: true,  user_count }
//   열림:            { locked: false, user_count, top: [...], me: {...} | null }

export interface RankingRow {
  rank:      number;
  nickname:  string;
  oneRepMax: number;
  weight:    number;
  reps:      number;
  isMe:      boolean;
}

export type GymMachineRanking =
  | { locked: true;  userCount: number }
  | { locked: false; userCount: number; top: RankingRow[]; me: RankingRow | null };

function toRow(r: any): RankingRow {
  return {
    rank:      Number(r?.rank),
    nickname:  r?.nickname ?? '',
    oneRepMax: Number(r?.one_rep_max),
    weight:    Number(r?.weight),
    reps:      Number(r?.reps),
    isMe:      r?.is_me === true,   // null → false
  };
}

/** 실패 시 null */
export async function fetchGymMachineRanking(gymId: string, machineId: string): Promise<GymMachineRanking | null> {
  try {
    const { data, error } = await supabase.rpc('get_gym_machine_ranking', {
      p_gym_id:     gymId,
      p_machine_id: machineId,
    });
    if (error) throw error;
    if (!data) return null;

    const userCount = Number(data.user_count ?? 0);
    if (data.locked) return { locked: true, userCount };

    return {
      locked: false,
      userCount,
      top: Array.isArray(data.top) ? data.top.map(toRow) : [],
      me:  data.me ? toRow(data.me) : null,
    };
  } catch (e) {
    if (__DEV__) console.warn('[machineRanking] fetchGymMachineRanking 오류:', e);
    return null;
  }
}
