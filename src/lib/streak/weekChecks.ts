// 2026-11-21: 홈 연속 기록 카드 오른쪽의 체크 표시 데이터
//
//  - 루틴 미설정: 이번 주 월~일. 운동일지를 쓴 요일에 체크
//  - 요일형: 이번 주 월~일 + 그날 부위. 운동한 날 체크, 휴식 요일은 지나가면 체크
//  - 순서형: 루틴 한 바퀴의 칸(휴식 포함). 이번 바퀴에서 지나간 칸 체크
//
// 순수 함수 — 화면/DB에 의존하지 않는다.

import type { UserSplitConfig, WeekdaySplit, SequentialSplit } from '../../data/types';
import { addDays, dayKey, startOfDay, weekMonday, WEEK_LABELS_MON_FIRST, WEEKDAY_KEYS_BY_DOW } from './dayKey';
import type { WorkoutDayMap } from './computeStreak';

export type CheckMode = 'week' | 'weekday' | 'sequential';

export interface CheckItem {
  key:       string;
  label:     string;          // 위 라벨 (요일 또는 부위)
  subLabel?: string;          // 요일형: 그날 부위
  checked:   boolean;
  isRest:    boolean;
  isCurrent: boolean;         // 오늘(주간) / 이번 차례(순서형)
  isFuture:  boolean;
}

export interface CheckRow {
  mode:  CheckMode;
  title: string;
  items: CheckItem[];
}

const REST = '휴식';

function workMuscles(slot: string[] | undefined | null): string[] {
  return (slot ?? []).filter(m => !!m && m !== REST);
}

function slotLabel(slot: string[]): string {
  const work = workMuscles(slot);
  return work.length > 0 ? work.join('·') : REST;
}

function isSequentialSet(cfg: UserSplitConfig | null): boolean {
  return !!cfg && cfg.splitType === 'sequential'
    && Array.isArray(cfg.workoutSplit) && (cfg.workoutSplit as SequentialSplit).length > 0;
}

function isWeekdaySet(cfg: UserSplitConfig | null): boolean {
  if (!cfg || cfg.splitType !== 'weekday' || !cfg.workoutSplit || Array.isArray(cfg.workoutSplit)) return false;
  const wd = cfg.workoutSplit as WeekdaySplit;
  return WEEKDAY_KEYS_BY_DOW.some(k => workMuscles(wd[k] as string[]).length > 0);
}

function buildWeekRow(days: WorkoutDayMap, cfg: UserSplitConfig | null, now: Date): CheckRow {
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const monday = weekMonday(today);
  const weekday = isWeekdaySet(cfg) ? (cfg!.workoutSplit as WeekdaySplit) : null;

  const items: CheckItem[] = WEEK_LABELS_MON_FIRST.map((label, i) => {
    const d = addDays(monday, i);
    const k = dayKey(d);
    const worked = days.has(k);
    const isPast = k < todayKey;
    let subLabel: string | undefined;
    let isRest = false;
    if (weekday) {
      const slot = weekday[WEEKDAY_KEYS_BY_DOW[d.getDay()]] as string[];
      subLabel = slotLabel(slot);
      isRest = subLabel === REST;
    }
    return {
      key: k,
      label,
      subLabel,
      checked: worked || (isRest && isPast),
      isRest,
      isCurrent: k === todayKey,
      isFuture: k > todayKey,
    };
  });

  return { mode: weekday ? 'weekday' : 'week', title: '이번 주', items };
}

function buildSequentialRow(days: WorkoutDayMap, cfg: UserSplitConfig, now: Date): CheckRow {
  const slots = cfg.workoutSplit as SequentialSplit;
  const len = slots.length;
  const current = ((cfg.splitCurrentIndex % len) + len) % len;
  // 오늘 운동해서 마지막 칸까지 끝내고 0번으로 돌아왔으면, 오늘 하루는 한 바퀴 완료로 보여준다
  const workedToday = days.has(dayKey(startOfDay(now)));
  const cycleJustDone = workedToday && current === 0;

  const items: CheckItem[] = slots.map((slot, i) => {
    const label = slotLabel(slot);
    const isRest = label === REST;
    return {
      key: `slot-${i}`,
      label,
      checked: cycleJustDone || i < current,
      isRest,
      isCurrent: !cycleJustDone && i === current,
      isFuture: !cycleJustDone && i > current,
    };
  });

  return { mode: 'sequential', title: '이번 루틴', items };
}

export function buildCheckRow(days: WorkoutDayMap, cfg: UserSplitConfig | null, now: Date = new Date()): CheckRow {
  if (isSequentialSet(cfg)) return buildSequentialRow(days, cfg!, now);
  return buildWeekRow(days, cfg, now);
}
