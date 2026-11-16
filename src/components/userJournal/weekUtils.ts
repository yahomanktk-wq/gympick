// 주별 줄(월요일 시작) 계산 — 본인 운동일지(JournalScreen)와 같은 규칙

export const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** 가장 오래된 날짜부터 이번 주까지 몇 주를 보여줄지 (최소 minWeeks) */
export function countWeeksSince(oldestIso: string | undefined, minWeeks: number): number {
  if (!oldestIso) return minWeeks;
  const diffWeeks = Math.ceil((Date.now() - new Date(oldestIso).getTime()) / (7 * 86_400_000));
  return Math.max(minWeeks, diffWeeks + 1);
}
