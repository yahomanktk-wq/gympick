// 2026-11-28: 홈 '이번 주' 썸네일에 날짜별 예정 부위를 붙이는 계산 (HomeScreen에서 분리)
//
//  - 요일형: 각 요일에 정해진 부위
//  - 순서형: splitCurrentIndex(다음 차례)부터 차례대로 배정.
//    오늘 이미 운동했다면 splitCurrentIndex는 이미 다음 차례로 넘어가 있으므로
//    오늘이 아니라 내일부터 배정한다. (연속 기록 카드의 '다음 운동'과 일치)
//
// 순수 함수 — 화면/DB에 의존하지 않는다.

import type { UserSplitConfig, WeekdaySplit } from '../../data/types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const REST = '휴식';

function slotText(slot: string[] | undefined | null): string | null {
  const targets = (slot ?? []) as string[];
  const work = targets.filter(m => m !== REST);
  if (work.length > 0) return work.join('·');
  return targets.length > 0 ? REST : null;
}

export function getWeekTargetMap(
  splitConfig: UserSplitConfig | null,
  weekDates: Date[],
  workedToday: boolean = false,
  now: Date = new Date(),
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  if (!splitConfig || !splitConfig.workoutSplit) {
    weekDates.forEach(d => { result[d.toDateString()] = null; });
    return result;
  }

  if (splitConfig.splitType === 'weekday') {
    const split = splitConfig.workoutSplit as WeekdaySplit;
    weekDates.forEach(d => {
      const key = DAY_KEYS[d.getDay()] as keyof WeekdaySplit;
      result[d.toDateString()] = slotText(split[key] as string[]);
    });
    return result;
  }

  const split = splitConfig.workoutSplit as string[][];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  // 배정 시작일: 오늘 운동을 마쳤으면 내일부터
  const start = new Date(today);
  if (workedToday) start.setDate(start.getDate() + 1);
  let idx = splitConfig.splitCurrentIndex;

  weekDates.forEach(d => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    if (date < start || split.length === 0) {
      result[d.toDateString()] = null;
    } else {
      result[d.toDateString()] = slotText(split[((idx % split.length) + split.length) % split.length]);
      idx++;
    }
  });

  return result;
}
