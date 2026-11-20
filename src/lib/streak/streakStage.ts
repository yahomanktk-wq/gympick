// 2026-11-21: 연속 일수에 따른 불꽃 단계
// 단계 구간은 여기 한 곳에서만 바꾼다. Lottie 파일을 넣을 때도 이 단계 번호를 그대로 쓴다.

export type StreakStage = 0 | 1 | 2 | 3;

/** 단계가 시작되는 연속 일수 (0단계: 0일, 1단계: 1~6일, 2단계: 7~29일, 3단계: 30일 이상) */
export const STREAK_STAGE_MIN_DAYS: Record<StreakStage, number> = {
  0: 0,
  1: 1,
  2: 7,
  3: 30,
};

export function streakStage(days: number): StreakStage {
  if (days >= STREAK_STAGE_MIN_DAYS[3]) return 3;
  if (days >= STREAK_STAGE_MIN_DAYS[2]) return 2;
  if (days >= STREAK_STAGE_MIN_DAYS[1]) return 1;
  return 0;
}
