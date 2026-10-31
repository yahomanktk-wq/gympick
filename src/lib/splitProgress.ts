import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutLog, SequentialSplit } from '../data/types';
import { calcNextIndex } from './splitUtils';
import { fetchSplitConfig, updateSplitIndex } from './db/splitRoutine';
import { fetchWorkoutLogs } from './db/workouts';
import { sessionTargetsKo } from './sessionTargets';

// 2026-10-31: 순서형 분할 루틴의 "오늘 차례" 넘기기.
//
// 예전 방식의 문제
//  - 머신 부위(보조 부위 포함)로 판단 → 가슴 운동 날 DIP ARM 하나로 '팔'까지 끝난 것으로 처리
//  - 운동일지 탭을 열 때만, 기기별 하루 1번 실행 → 저장만 하면 순서가 안 넘어가기도 함
//  - 일지를 지우면 무조건 한 칸 되돌림 → 안 넘어갔던 날이나 휴식을 건너뛴 날엔 엉뚱한 칸으로
//
// 새 방식
//  - 작성 때 고른 타겟 부위(sessionTargetsKo)로 판단
//  - "오늘 첫 저장 전 차례(시작 칸)"를 기기에 기억해 두고, 매번 시작 칸 + 오늘 한 부위 전체로
//    다시 계산한다. 저장 직후·운동일지 탭·일지 삭제 어디서 불러도 같은 결과가 나온다(멱등).
//  - 오늘 일지를 다 지우면 시작 칸으로 정확히 돌아간다.
//  - 다른 기기나 분할 설정 화면에서 차례를 바꿨으면(마지막으로 쓴 값과 다르면) 그 값을 새 시작 칸으로 본다.

interface DayState {
  start: number;   // 오늘 첫 저장 전 차례
  after: number;   // 이 함수가 마지막으로 저장한 차례
  split: string;   // 분할 구성 (바뀌면 기억값 무효)
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function stateKey(userId: string): string {
  return `split_day_state_${userId}_${new Date().toDateString()}`;
}

async function readState(userId: string): Promise<DayState | null> {
  try {
    const raw = await AsyncStorage.getItem(stateKey(userId));
    return raw ? (JSON.parse(raw) as DayState) : null;
  } catch {
    return null;
  }
}

async function writeState(userId: string, state: DayState): Promise<void> {
  try { await AsyncStorage.setItem(stateKey(userId), JSON.stringify(state)); } catch {}
}

/**
 * 오늘 운동일지를 기준으로 분할 차례를 맞춘다. 순서형이 아니거나 설정이 없으면 아무것도 안 한다.
 * @param logs 이미 불러온 운동일지 목록이 있으면 넘긴다(없으면 조회). 삭제 직후엔 남은 목록을 넘긴다.
 * @returns 맞춘 뒤의 차례(index). 아무것도 하지 않았으면 null.
 */
export async function syncSplitProgress(userId: string, logs?: WorkoutLog[]): Promise<number | null> {
  try {
    const cfg = await fetchSplitConfig(userId);
    if (!cfg || cfg.splitType !== 'sequential') return null;
    const split = cfg.workoutSplit as SequentialSplit;
    if (!Array.isArray(split) || split.length === 0) return null;

    const splitSig = JSON.stringify(split);
    const current  = cfg.splitCurrentIndex % split.length;
    const all      = logs ?? await fetchWorkoutLogs(userId);
    const today    = all.filter(s => isToday(s.date));

    const saved = await readState(userId);
    const savedValid = !!saved && saved.split === splitSig && saved.after === current;

    // 오늘 기억해 둔 시작 칸이 없으면: 오늘 일지가 없으면 할 일 없음, 있으면 지금 차례를 시작 칸으로
    if (!savedValid && today.length === 0) return null;
    const start = savedValid ? saved!.start : current;

    const done = [...new Set(today.flatMap(s => sessionTargetsKo(s)))];
    const next = done.length > 0 ? calcNextIndex(split, start, done) : start;

    if (next !== current) {
      const ok = await updateSplitIndex(userId, next);
      if (!ok) return null;
    }
    await writeState(userId, { start, after: next, split: splitSig });
    return next;
  } catch (e) {
    if (__DEV__) console.warn('[splitProgress] sync 실패:', e);
    return null;
  }
}
