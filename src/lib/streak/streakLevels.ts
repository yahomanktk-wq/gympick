// 2026-11-23: 연속 일수 50단계 단어 (홈 연속 기록 카드 왼쪽 칸)
//
//  - 0단계: 시작
//  - 1~20단계 (1~20일, 매일 한 단계): 꾸준함 구간 — 흰색
//  - 21~31단계 (21~99일): 뜨거운 구간 — 주황
//  - 32~50단계 (100일 이상): 전설 구간 — 라임
//
// 단어와 일수는 이 표 한 곳에서만 바꾼다. minDays는 반드시 오름차순.

export type StreakTone = 'start' | 'steady' | 'hot' | 'legend';

export interface StreakLevelDef {
  minDays: number;
  word:    string;
}

export const STREAK_LEVELS: readonly StreakLevelDef[] = [
  { minDays: 0,    word: '시작' },
  // 꾸준함 구간 (매일)
  { minDays: 1,    word: '첫발' },
  { minDays: 2,    word: '다짐' },
  { minDays: 3,    word: '작심' },
  { minDays: 4,    word: '출석' },
  { minDays: 5,    word: '반복' },
  { minDays: 6,    word: '성실' },
  { minDays: 7,    word: '루틴' },
  { minDays: 8,    word: '습관' },
  { minDays: 9,    word: '매일' },
  { minDays: 10,   word: '꾸준' },
  { minDays: 11,   word: '근면' },
  { minDays: 12,   word: '우직' },
  { minDays: 13,   word: '묵묵' },
  { minDays: 14,   word: '끈기' },
  { minDays: 15,   word: '인내' },
  { minDays: 16,   word: '지속' },
  { minDays: 17,   word: '정진' },
  { minDays: 18,   word: '단련' },
  { minDays: 19,   word: '연마' },
  { minDays: 20,   word: '본능' },
  // 뜨거운 구간
  { minDays: 21,   word: '점화' },
  { minDays: 25,   word: '투지' },
  { minDays: 30,   word: '화염' },
  { minDays: 35,   word: '근성' },
  { minDays: 40,   word: '패기' },
  { minDays: 45,   word: '열혈' },
  { minDays: 50,   word: '각성' },
  { minDays: 60,   word: '돌파' },
  { minDays: 70,   word: '폭주' },
  { minDays: 80,   word: '맹화' },
  { minDays: 90,   word: '폭발' },
  // 전설 구간
  { minDays: 100,  word: '철인' },
  { minDays: 120,  word: '화산' },
  { minDays: 150,  word: '용암' },
  { minDays: 180,  word: '강철' },
  { minDays: 200,  word: '불굴' },
  { minDays: 250,  word: '야수' },
  { minDays: 300,  word: '격노' },
  { minDays: 365,  word: '정복' },
  { minDays: 400,  word: '업화' },
  { minDays: 450,  word: '투사' },
  { minDays: 500,  word: '전사' },
  { minDays: 550,  word: '괴물' },
  { minDays: 600,  word: '무적' },
  { minDays: 650,  word: '폭군' },
  { minDays: 700,  word: '패왕' },
  { minDays: 730,  word: '전설' },
  { minDays: 800,  word: '군림' },
  { minDays: 900,  word: '신화' },
  { minDays: 1000, word: '불멸' },
];

/** 구간이 시작되는 일수 */
export const STREAK_TONE_MIN_DAYS = { steady: 1, hot: 21, legend: 100 } as const;

export interface StreakLevel {
  level: number;       // 0~50
  word:  string;
  tone:  StreakTone;
}

export function streakTone(days: number): StreakTone {
  if (days >= STREAK_TONE_MIN_DAYS.legend) return 'legend';
  if (days >= STREAK_TONE_MIN_DAYS.hot)    return 'hot';
  if (days >= STREAK_TONE_MIN_DAYS.steady) return 'steady';
  return 'start';
}

export function streakLevel(days: number): StreakLevel {
  const d = Math.max(0, Math.floor(days));
  let level = 0;
  for (let i = STREAK_LEVELS.length - 1; i >= 0; i--) {
    if (d >= STREAK_LEVELS[i].minDays) { level = i; break; }
  }
  return { level, word: STREAK_LEVELS[level].word, tone: streakTone(d) };
}
