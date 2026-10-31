import { parseMuscles, toKoMuscle } from './splitUtils';

// 2026-10-31: "이 운동일지는 어떤 부위 운동이었나"를 판단하는 공통 기준.
// 홈 '지난 운동 기록' 팝업과 분할 루틴 순서 넘기기가 같은 기준을 쓴다.
//
// 기준: 운동일지를 작성할 때 유저가 고른 타겟 부위(workout_sessions.target_muscles).
// 머신 부위(특히 'Arms, Chest' 같은 보조 부위)는 보지 않는다 — 가슴 운동 날 DIP ARM
// 머신 하나 때문에 '팔 운동'으로 잡히던 문제를 막기 위해서다.
// 예외: 타겟을 저장하지 않던 옛 운동일지(2026-07 이전)만 머신 주 부위의 다수결로 판단한다.

interface SessionLike {
  targetMuscles?: string[] | null;
  machines?: Array<{ targetMuscle?: string }> | null;
}

// 영어 표기 흔들림(복수형·괄호 표기)을 한글 부위명으로 맞춘다. 나머지는 splitUtils 매핑을 따른다.
const EXTRA_EN_TO_KO: Record<string, string> = {
  legs: '하체', leg: '하체',
  shoulders: '어깨', shoulder: '어깨',
  arm: '팔', arms: '팔',
  glute: '엉덩이', glutes: '엉덩이', 'hip (glutes)': '엉덩이',
  chest: '가슴', back: '등', core: '코어', cardio: '유산소', 'full body': '전신',
};

export function muscleToKo(m: string): string {
  const t = m.trim();
  return EXTRA_EN_TO_KO[t.toLowerCase()] ?? toKoMuscle(t);
}

/**
 * 작성할 때 고른 타겟 부위(한글). 없으면 빈 배열.
 * fetchWorkoutLogs는 타겟 기록이 없는 옛 세션을 머신 targetMuscle 원문('Arms, Chest')으로
 * 채워 주므로, 콤마가 들어간 값이 섞여 있으면 "고른 타겟이 아님"으로 본다.
 */
export function declaredTargetsKo(s: SessionLike): string[] {
  const raw = (s.targetMuscles ?? []).filter(Boolean);
  if (raw.length === 0 || raw.some(t => t.includes(','))) return [];
  return [...new Set(raw.map(muscleToKo))];
}

/** 옛 세션용: 머신 주 부위(첫 번째 값) 기준으로 절반 이상을 차지한 부위들 */
function majorityPrimaryKo(s: SessionLike): string[] {
  const machines = s.machines ?? [];
  if (machines.length === 0) return [];
  const counts = new Map<string, number>();
  for (const m of machines) {
    const first = parseMuscles(m.targetMuscle)[0];
    if (!first) continue;
    const ko = muscleToKo(first);
    counts.set(ko, (counts.get(ko) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n * 2 >= machines.length)
    .map(([ko]) => ko);
}

/** 이 세션의 운동 부위(한글). 고른 타겟 우선, 없으면 머신 주 부위 다수결. */
export function sessionTargetsKo(s: SessionLike): string[] {
  const declared = declaredTargetsKo(s);
  return declared.length > 0 ? declared : majorityPrimaryKo(s);
}

/** 이 세션이 targetKo(한글 부위) 운동이었는지 */
export function sessionMatchesTargetKo(s: SessionLike, targetKo: string): boolean {
  return sessionTargetsKo(s).includes(muscleToKo(targetKo));
}
