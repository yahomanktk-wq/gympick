// 2026-11-21: 운동일지 목록 → 날짜별 운동 부위 맵 (연속 기록·체크 표시 공통 입력)

import type { WorkoutLog } from '../../data/types';
import { sessionTargetsKo } from '../sessionTargets';
import { dayKey } from './dayKey';
import type { WorkoutDayMap } from './computeStreak';

export function buildWorkoutDayMap(logs: WorkoutLog[]): WorkoutDayMap {
  const map: WorkoutDayMap = new Map();
  for (const log of logs) {
    const d = new Date(log.date);
    if (isNaN(d.getTime())) continue;
    const k = dayKey(d);
    const prev = map.get(k) ?? [];
    const merged = [...new Set([...prev, ...sessionTargetsKo(log)])];
    map.set(k, merged);
  }
  return map;
}
