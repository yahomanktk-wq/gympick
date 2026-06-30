import { SplitType, WorkoutSplit, WeekdaySplit, SequentialSplit } from '../data/types';

// 머신 targetMuscle(영어) → 분할 루틴 부위명(한글) 매핑
export const MUSCLE_EN_TO_KO: Record<string, string> = {
  'Chest':        '가슴',
  'Back':         '등',
  'Leg':          '하체',
  'Shoulder':     '어깨',
  'Arms':         '팔',
  'Core':         '코어',
  'Cardio':       '유산소',
  'Full Body':    '전신',
  'Glutes':       '엉덩이',
  'Hip (Glutes)': '엉덩이',
};

// 분할 루틴 부위명(한글) → 머신 targetMuscle(영어) 매핑
export const MUSCLE_KO_TO_EN: Record<string, string> = {
  '가슴':   'Chest',
  '등':     'Back',
  '하체':   'Leg',
  '엉덩이': 'Hip (Glutes)',
  '어깨':   'Shoulder',
  '팔':     'Arms',
  '코어':   'Core',
  '유산소': 'Cardio',
  '전신':   'Full Body',
};

export function toKoMuscle(en: string): string {
  return MUSCLE_EN_TO_KO[en] ?? en;
}

export function toEnMuscle(ko: string): string {
  return MUSCLE_KO_TO_EN[ko] ?? ko;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayKey = typeof DAY_KEYS[number];

export function getTodayTarget(
  splitType: SplitType,
  workoutSplit: WorkoutSplit,
  splitCurrentIndex: number
): string | null {
  return getTodayTargets(splitType, workoutSplit, splitCurrentIndex)[0] ?? null;
}

export function getNextTarget(
  splitType: SplitType,
  workoutSplit: WorkoutSplit,
  splitCurrentIndex: number,
  completedTargets: string[]
): string | null {
  return getNextTargets(splitType, workoutSplit, splitCurrentIndex, completedTargets)[0] ?? null;
}

export function calcNextIndex(
  workoutSplit: SequentialSplit,   // string[][]
  currentIndex: number,
  completedTargets: string[]
): number {
  const len = workoutSplit.length;
  if (len === 0) return 0;
  const done = completedTargets.map(t => t.toLowerCase());
  let idx = currentIndex;
  let advanced = 0;
  while (advanced < len) {
    const slot = workoutSplit[idx % len] ?? [];
    const work = workoutMusclesOf(slot);
    if (work.length === 0) { idx++; advanced++; continue; }          // 휴식/빈 슬롯 건너뜀
    const slotDone = work.some(m => done.includes(m.toLowerCase()));
    if (!slotDone) break;                                            // 아직 안 한 슬롯에서 멈춤
    idx++;
    advanced++;
  }
  return idx % len;
}

export function extractCompletedTargets(
  machines: Array<{ targetMuscle?: string }>
): string[] {
  return [
    ...new Set(
      machines
        .map(m => m.targetMuscle)
        .filter((t): t is string => !!t)
        .map(t => toKoMuscle(t))
    )
  ];
}

// ── 다중 타겟부위 지원 API (배열 반환) ─────────────────────────────────
// 부위 배열에서 '휴식'/빈값 제외
function workoutMusclesOf(muscles: string[]): string[] {
  return muscles.filter(m => !!m && m !== '휴식');
}

// 오늘의 운동 부위들 (휴식/미설정이면 빈 배열). 한글 부위명.
export function getTodayTargets(
  splitType: SplitType,
  workoutSplit: WorkoutSplit,
  splitCurrentIndex: number
): string[] {
  if (!workoutSplit || (Array.isArray(workoutSplit) && workoutSplit.length === 0)) return [];

  if (splitType === 'weekday') {
    const split = workoutSplit as WeekdaySplit;
    const dayKey = DAY_KEYS[new Date().getDay()];
    return workoutMusclesOf((split[dayKey] ?? []) as string[]);
  }

  const split = workoutSplit as SequentialSplit; // string[][]
  if (split.length === 0) return [];
  const slot = split[splitCurrentIndex % split.length] ?? [];
  return workoutMusclesOf(slot);
}

// 오늘이 명시적 휴식인지
export function isRestToday(
  splitType: SplitType,
  workoutSplit: WorkoutSplit,
  splitCurrentIndex: number
): boolean {
  if (!workoutSplit) return false;

  if (splitType === 'weekday') {
    const split = workoutSplit as WeekdaySplit;
    const dayKey = DAY_KEYS[new Date().getDay()];
    const m = (split[dayKey] ?? []) as string[];
    return m.length > 0 && workoutMusclesOf(m).length === 0;
  }

  const split = workoutSplit as SequentialSplit; // string[][]
  if (split.length === 0) return false;
  const slot = split[splitCurrentIndex % split.length] ?? [];
  return slot.length > 0 && workoutMusclesOf(slot).length === 0;
}

// 루틴 전체 부위 모으기 (배너의 "루틴 부위 했나" 판정용)
export function collectRoutineMuscles(
  splitType: SplitType,
  workoutSplit: WorkoutSplit
): string[] {
  if (splitType === 'sequential') {
    return ((workoutSplit as SequentialSplit) ?? []).flat().filter(m => m !== '휴식');
  }
  const wd = workoutSplit as WeekdaySplit;
  return DAY_KEYS.flatMap(k => (wd[k] ?? []) as string[]).filter(m => m !== '휴식');
}

// 다음 운동 부위들 (완료 제외, 휴식 건너뜀)
export function getNextTargets(
  splitType: SplitType,
  workoutSplit: WorkoutSplit,
  splitCurrentIndex: number,
  completedTargets: string[]
): string[] {
  if (!workoutSplit || (Array.isArray(workoutSplit) && workoutSplit.length === 0)) return [];
  const done = completedTargets.map(t => t.toLowerCase());

  if (splitType === 'sequential') {
    const split = workoutSplit as SequentialSplit; // string[][]
    let idx = splitCurrentIndex, checked = 0;
    while (checked < split.length) {
      const slot = split[idx % split.length] ?? [];
      const work = workoutMusclesOf(slot);
      if (work.length === 0) { idx++; checked++; continue; }          // 휴식/빈 슬롯 건너뜀
      const slotDone = work.some(m => done.includes(m.toLowerCase()));
      if (!slotDone) return work;                                     // 느슨한 완료
      idx++; checked++;
    }
    return [];
  }

  const split = workoutSplit as WeekdaySplit;
  const todayIdx = new Date().getDay();
  for (let i = 1; i <= 7; i++) {
    const dayKey = DAY_KEYS[(todayIdx + i) % 7];
    const work = workoutMusclesOf((split[dayKey] ?? []) as string[]);
    if (work.length > 0) return work;
  }
  return [];
}
