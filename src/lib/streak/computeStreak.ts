// 2026-11-21: 루틴(분할 설정)을 반영한 연속 운동 일수 계산
//
// 규칙
//  - 운동일지가 있는 날은 항상 연속에 포함된다.
//  - 쉬는 날은 "인정"될 때만 연속에 포함되고, 그날도 +1일로 센다.
//      · 루틴 미설정: 쉬는 날 인정 없음 (매일 운동해야 이어짐)
//      · 요일형: 그 요일 설정이 휴식(또는 빈 요일)이면 인정
//      · 순서형: 휴식 칸이 올 차례일 때만 인정
//          운동한 날 A에 끝낸 칸 바로 뒤에 휴식 칸이 k개 이어지면, A 다음 날부터 k일까지 인정
//          (예: 가슴 → 등 → 휴식 → 하체 — 등 한 다음 날 하루 쉬면 이어짐, 이틀 쉬면 끊김)
//  - 오늘 아직 운동 안 했으면 오늘은 끊김으로 보지 않는다 (인정되는 휴식 날이면 +1)
//  - 연속 구간에는 운동한 날이 최소 1번 있어야 한다 (휴식만으로는 시작되지 않음)
//
// 순수 함수 — 화면/DB에 의존하지 않는다.

import type { SplitType, WorkoutSplit, WeekdaySplit, SequentialSplit } from '../../data/types';
import { addDays, dayKey, startOfDay, WEEKDAY_KEYS_BY_DOW } from './dayKey';

/** 날짜 키(YYYY-MM-DD) → 그날 운동한 부위(한글). 운동한 날만 들어 있다 */
export type WorkoutDayMap = Map<string, string[]>;

export interface StreakSplit {
  splitType:    SplitType;
  workoutSplit: WorkoutSplit;
}

const REST = '휴식';
const MAX_LOOKBACK_DAYS = 800;

function workMuscles(slot: string[] | undefined | null): string[] {
  return (slot ?? []).filter(m => !!m && m !== REST);
}

function hasSplit(split: StreakSplit | null | undefined): split is StreakSplit {
  if (!split || !split.workoutSplit) return false;
  if (split.splitType === 'sequential') {
    return Array.isArray(split.workoutSplit) && split.workoutSplit.length > 0;
  }
  const wd = split.workoutSplit as WeekdaySplit;
  return WEEKDAY_KEYS_BY_DOW.some(k => workMuscles(wd[k] as string[]).length > 0);
}

// ── 요일형 ──────────────────────────────────────────────────────────────────

/** 요일형: 그날이 휴식 요일인지 (빈 요일도 휴식) */
export function isWeekdayRest(split: WeekdaySplit, d: Date): boolean {
  const key = WEEKDAY_KEYS_BY_DOW[d.getDay()];
  return workMuscles(split[key] as string[]).length === 0;
}

// ── 순서형 ──────────────────────────────────────────────────────────────────

/**
 * 순서형: 그날 한 부위(targets)로 끝낸 칸 뒤에 이어지는 휴식 칸 수.
 * 같은 부위가 여러 칸에 있으면 휴식이 가장 길게 이어지는 칸으로 본다(유저에게 유리하게).
 * 어느 칸에도 맞지 않으면 0.
 */
export function restAllowanceAfter(slots: SequentialSplit, targets: string[]): number {
  const len = slots.length;
  if (len === 0 || targets.length === 0) return 0;
  const done = targets.map(t => t.toLowerCase());
  let best = 0;
  for (let i = 0; i < len; i++) {
    const work = workMuscles(slots[i]);
    if (work.length === 0) continue;
    if (!work.some(m => done.includes(m.toLowerCase()))) continue;
    let k = 0;
    while (k < len - 1 && workMuscles(slots[(i + 1 + k) % len]).length === 0) k++;
    if (k > best) best = k;
  }
  return best;
}

// ── 계산 ────────────────────────────────────────────────────────────────────

/** 쉬는 날 d가 인정되는지. lastWorkoutKey/gap은 d 이전 가장 가까운 운동일과 그로부터 며칠째인지 */
function isRestAllowed(
  split: StreakSplit | null,
  d: Date,
  lastWorkoutTargets: string[] | null,
  gap: number,
): boolean {
  if (!hasSplit(split)) return false;
  if (split.splitType === 'weekday') {
    return isWeekdayRest(split.workoutSplit as WeekdaySplit, d);
  }
  if (!lastWorkoutTargets) return false;
  return gap <= restAllowanceAfter(split.workoutSplit as SequentialSplit, lastWorkoutTargets);
}

/** d 이전(d 제외)의 가장 가까운 운동일과 그 날까지의 간격(일) */
function findPrevWorkout(days: WorkoutDayMap, d: Date, oldestKey: string): { targets: string[]; gap: number } | null {
  for (let gap = 1; gap <= MAX_LOOKBACK_DAYS; gap++) {
    const k = dayKey(addDays(d, -gap));
    if (k < oldestKey) return null;
    const t = days.get(k);
    if (t) return { targets: t, gap };
  }
  return null;
}

export function computeStreakWithSplit(
  days: WorkoutDayMap,
  split: StreakSplit | null,
  now: Date = new Date(),
): number {
  if (days.size === 0) return 0;
  const today = startOfDay(now);
  const oldestKey = [...days.keys()].sort()[0];

  // 하루가 연속에 들어가는지: 'workout' | 'rest'(인정된 휴식) | null(끊김)
  const classify = (d: Date): 'workout' | 'rest' | null => {
    const k = dayKey(d);
    if (days.has(k)) return 'workout';
    const prev = findPrevWorkout(days, d, oldestKey);
    if (!prev) return null;
    return isRestAllowed(split, d, prev.targets, prev.gap) ? 'rest' : null;
  };

  // 어제부터 거꾸로 센다
  const counted: Array<'workout' | 'rest'> = [];
  for (let i = 1; i <= MAX_LOOKBACK_DAYS; i++) {
    const d = addDays(today, -i);
    if (dayKey(d) < oldestKey) break;
    const c = classify(d);
    if (!c) break;
    counted.push(c);
  }
  // 가장 오래된 쪽의 휴식(운동 전 휴식)은 빼기 — 연속은 운동한 날부터 시작
  while (counted.length > 0 && counted[counted.length - 1] === 'rest') counted.pop();

  // 오늘: 운동했으면 +1, 인정되는 휴식이면 +1, 아니면 아직 끊긴 게 아님(0)
  const todayClass = classify(today);
  if (todayClass === 'workout') return counted.length + 1;
  if (counted.length === 0) return 0;
  return counted.length + (todayClass === 'rest' ? 1 : 0);
}
