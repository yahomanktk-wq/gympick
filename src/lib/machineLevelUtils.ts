import { MachineLevelData } from '../data/types';

// ── 레벨별 필요 XP ────────────────────────────────────────────────────────────
// Lv1→2: 100, 이후 20씩 증가
// Lv10→11부터: 50씩 증가
// Lv30→31부터: 100씩 증가
// Lv60→61부터: 200씩 증가

export function getRequiredXP(level: number): number {
  if (level <= 0 || level >= 99) return Infinity;

  // Lv1→2: 100, 2→3: 120, ... each +20 up to Lv9→10
  // From Lv10→11: switch to +50 increments
  // From Lv30→31: switch to +100 increments
  // From Lv60→61: switch to +200 increments

  if (level <= 9) {
    // 100, 120, 140, ...: 100 + (level-1)*20
    return 100 + (level - 1) * 20;
  }

  // Base at Lv9→10 = 100 + 8*20 = 260
  const base9 = 260;

  if (level <= 29) {
    // Lv10→11: 260+50=310, Lv11→12: 360, ... each +50
    return base9 + (level - 9) * 50;
  }

  // Base at Lv29→30 = 260 + 20*50 = 1260
  const base29 = 260 + 20 * 50;

  if (level <= 59) {
    // Lv30→31: 1260+100=1360, each +100
    return base29 + (level - 29) * 100;
  }

  // Base at Lv59→60 = 1260 + 30*100 = 4260
  const base59 = base29 + 30 * 100;

  // Lv60→61: 4260+200=4460, each +200
  return base59 + (level - 59) * 200;
}

// ── 레벨 진행도 ───────────────────────────────────────────────────────────────

export function getLevelProgress(data: MachineLevelData): {
  level:          number;
  progressRatio:  number;
  currentLevelXP: number;
  requiredXP:     number;
} {
  const level      = Math.min(Math.max(data.level, 1), 99);
  const requiredXP = getRequiredXP(level);
  if (requiredXP === Infinity) {
    return { level, progressRatio: 1, currentLevelXP: data.currentXP, requiredXP: 0 };
  }
  const progressRatio = Math.min(data.currentXP / requiredXP, 1);
  return { level, progressRatio, currentLevelXP: data.currentXP, requiredXP };
}

// ── XP 계산 ───────────────────────────────────────────────────────────────────

export function calculateXP(params: {
  volume:           number;   // kg 볼륨 합계
  isPR:             boolean;
  isFirstUse:       boolean;
  weeklyUsageCount: number;
}): {
  baseXP:        number;
  prBonus:       number;
  firstUseBonus: number;
  streakBonus:   number;
  totalXP:       number;
} {
  const baseXP        = Math.floor(params.volume / 100);   // 100kg당 1XP
  const prBonus       = params.isPR        ? 50 : 0;
  const firstUseBonus = params.isFirstUse  ? 30 : 0;
  const streakBonus   = params.weeklyUsageCount >= 2 ? 10 : 0;
  const totalXP       = baseXP + prBonus + firstUseBonus + streakBonus;
  return { baseXP, prBonus, firstUseBonus, streakBonus, totalXP };
}

// ── XP 추가 및 레벨업 처리 ────────────────────────────────────────────────────

export function addXP(
  data:     MachineLevelData,
  xpToAdd:  number,
): {
  updatedData: MachineLevelData;
  leveledUp:   boolean;
  newLevel:    number;
} {
  if (data.level >= 99) {
    return { updatedData: data, leveledUp: false, newLevel: 99 };
  }

  let level     = data.level;
  let currentXP = data.currentXP + xpToAdd;
  const totalXP = data.totalXP  + xpToAdd;
  let leveledUp = false;

  while (level < 99) {
    const req = getRequiredXP(level);
    if (currentXP >= req) {
      currentXP -= req;
      level      += 1;
      leveledUp   = true;
    } else {
      break;
    }
  }

  if (level >= 99) currentXP = 0; // 최대 레벨 도달 시 XP 중단

  const updatedData: MachineLevelData = {
    ...data,
    level,
    currentXP,
    totalXP,
    lastUsedAt:       new Date().toISOString(),
    weeklyUsageCount: data.weeklyUsageCount + 1,
  };

  return { updatedData, leveledUp, newLevel: level };
}

// ── 레벨 색상 ─────────────────────────────────────────────────────────────────

export function getLevelColor(level: number): string {
  if (level >= 61) return '#FF9800'; // 골드 — 헌신
  if (level >= 31) return '#9C27B0'; // 보라 — 장기유저
  if (level >= 11) return '#2196F3'; // 파랑 — 습관화
  return '#9E9E9E';                   // 회색 — 입문
}

// ── 레벨 칭호 ─────────────────────────────────────────────────────────────────

export function getLevelTitle(level: number): string {
  if (level >= 61) return '고수';
  if (level >= 31) return '숙련';
  if (level >= 11) return '단련';
  return '입문';
}
