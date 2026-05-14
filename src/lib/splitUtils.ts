import { SplitType, WorkoutSplit, WeekdaySplit, SequentialSplit } from '../data/types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayKey = typeof DAY_KEYS[number];

export function getTodayTarget(
  splitType: SplitType,
  workoutSplit: WorkoutSplit,
  splitCurrentIndex: number
): string | null {
  if (!workoutSplit || (Array.isArray(workoutSplit) && workoutSplit.length === 0)) return null;

  if (splitType === 'weekday') {
    const split = workoutSplit as WeekdaySplit;
    const dayKey = DAY_KEYS[new Date().getDay()];
    const targets = (split[dayKey] ?? []) as string[];
    const nonRest = targets.filter(t => t !== '휴식');
    return nonRest.length > 0 ? nonRest[0] : null;
  }

  const split = workoutSplit as SequentialSplit;
  if (split.length === 0) return null;
  const target = split[splitCurrentIndex % split.length] ?? null;
  return target === '휴식' ? null : target;
}

export function getNextTarget(
  splitType: SplitType,
  workoutSplit: WorkoutSplit,
  splitCurrentIndex: number,
  completedTargets: string[]
): string | null {
  if (!workoutSplit || (Array.isArray(workoutSplit) && workoutSplit.length === 0)) return null;

  if (splitType === 'sequential') {
    const split = workoutSplit as SequentialSplit;
    let idx = splitCurrentIndex;
    let checked = 0;
    while (checked < split.length) {
      const target = split[idx % split.length];
      if (target === '휴식') { idx++; checked++; continue; }
      if (!completedTargets.map(t => t.toLowerCase()).includes(target.toLowerCase())) return target;
      idx++;
      checked++;
    }
    return null;
  }

  const split = workoutSplit as WeekdaySplit;
  const todayIdx = new Date().getDay();
  for (let i = 1; i <= 7; i++) {
    const dayKey = DAY_KEYS[(todayIdx + i) % 7];
    const targets = (split[dayKey] ?? []) as string[];
    const nonRest = targets.filter(t => t !== '휴식');
    if (nonRest.length > 0) return nonRest[0];
  }
  return null;
}

export function calcNextIndex(
  workoutSplit: SequentialSplit,
  currentIndex: number,
  completedTargets: string[]
): number {
  const len = workoutSplit.length;
  if (len === 0) return 0;
  let idx = currentIndex;
  let advanced = 0;
  while (advanced < len) {
    const target = workoutSplit[idx % len];
    if (target === '휴식') { idx++; advanced++; continue; }
    if (!completedTargets.map(t => t.toLowerCase()).includes(target.toLowerCase())) break;
    idx++;
    advanced++;
  }
  return idx % len;
}

export function extractCompletedTargets(todaySessions: Array<{ targetMuscle?: string }>): string[] {
  return todaySessions
    .map(s => s.targetMuscle)
    .filter((t): t is string => !!t);
}
