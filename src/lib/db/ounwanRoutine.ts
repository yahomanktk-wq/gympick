import { supabase } from '../supabase';
import { fetchWorkoutSessionById } from './feedPosts';

// 오운완 상세의 '운동 루틴' 데이터 (2026-10-20).
// 운동일지 테이블은 본인·매니저·어드민만 읽을 수 있어서, 다른 사람의 오운완은
// get_ounwan_routine RPC(공개 글이거나 내 글일 때만 루틴 반환)로 불러온다.
// RPC가 아직 없거나 실패하면 기존 방식(본인 글이면 직접 조회)으로 대체한다.

export interface OunwanRoutineSet { weight: number; reps: number }

export interface OunwanRoutineEntry {
  machineId:    string;
  machineName:  string;
  machineBrand: string;
  targetMuscle: string;
  sets:         OunwanRoutineSet[];
}

export interface OunwanRoutine {
  date:             string;
  gymId:            string | null;
  gymName:          string;
  overlayTextColor: string | null;
  targetMuscles:    string[];
  entries:          OunwanRoutineEntry[];
}

function fromRpc(d: any): OunwanRoutine | null {
  if (!d || !Array.isArray(d.entries)) return null;
  return {
    date:             d.date,
    gymId:            d.gym_id ?? null,
    gymName:          d.gym_name ?? '',
    overlayTextColor: d.overlay_text_color ?? null,
    targetMuscles:    Array.isArray(d.target_muscles) ? d.target_muscles : [],
    entries: d.entries.map((e: any) => ({
      machineId:    e.machine_id,
      machineName:  e.machine_name ?? '',
      machineBrand: e.machine_brand ?? '',
      targetMuscle: e.target_muscle ?? '',
      sets: (e.sets ?? []).map((s: any) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
    })),
  };
}

/** 기존 직접 조회 결과(fetchWorkoutSessionById) → OunwanRoutine (본인 글 대체 경로) */
function fromLegacy(d: any, muscles: string[]): OunwanRoutine | null {
  if (!d) return null;
  return {
    date:             d.date,
    gymId:            null,
    gymName:          d.gymName ?? '',
    overlayTextColor: null,
    targetMuscles:    muscles,
    entries: (d.machines ?? []).map((m: any) => ({
      machineId:    m.machineId,
      machineName:  m.machineName ?? '',
      machineBrand: m.machineBrand ?? '',
      targetMuscle: '',
      sets: (m.allSets ?? []).map((s: any) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
    })),
  };
}

export async function fetchOunwanRoutine(
  postId: string,
  sessionId: string | undefined,
  muscles: string[],
): Promise<OunwanRoutine | null> {
  try {
    const { data, error } = await supabase.rpc('get_ounwan_routine', { p_post_id: postId });
    if (!error) {
      const r = fromRpc(data);
      if (r) return r;
    } else if (__DEV__) {
      console.warn('[ounwanRoutine] rpc error:', error.message);
    }
  } catch (e) {
    if (__DEV__) console.warn('[ounwanRoutine] rpc exception:', e);
  }
  // 대체 경로: 본인 글이면 RLS상 직접 읽을 수 있다
  if (!sessionId) return null;
  try {
    return fromLegacy(await fetchWorkoutSessionById(sessionId), muscles);
  } catch {
    return null;
  }
}
