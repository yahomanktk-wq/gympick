// 2026-11-21: 연속 운동 기록용 날짜 도우미 (기기 로컬 = KST 달력일 기준)

/** 로컬 달력일 키 (YYYY-MM-DD). HomeScreen의 localDayKey와 같은 방식 */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** d에서 n일 이동한 날 (자정 기준 새 Date) */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** 그날 자정 */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 이번 주 월요일 자정 */
export function weekMonday(today: Date): Date {
  const d = startOfDay(today);
  const dow = d.getDay();
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

export const WEEKDAY_KEYS_BY_DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const WEEK_LABELS_MON_FIRST = ['월', '화', '수', '목', '금', '토', '일'] as const;
