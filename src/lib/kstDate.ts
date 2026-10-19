// KST(Asia/Seoul, UTC+9, DST 없음) 날짜 유틸 — 기기 타임존과 무관하게 동작
//
// 기대값:
// - kstDateKey('2026-10-19T23:30:00Z')        → '2026-10-20'
//   kstHourAndWeekday('2026-10-19T23:30:00Z') → { hour: 8, weekday: 2 } (화요일)
// - kstDateKey('2026-09-30T16:00:00Z')        → '2026-10-01' (KST 10/1 01:00 → 10월)
// - kstDayStartUtcIso('2026-10-19')           → '2026-10-18T15:00:00.000Z'
//   kstDayEndExclusiveUtcIso('2026-10-19')    → '2026-10-19T15:00:00.000Z'
// - kstAddDays('2026-03-01', -1)              → '2026-02-28'
// - kstMonthRanges() (KST 오늘 2026-10-19)    → thisStart '2026-10-01', thisEnd '2026-10-19',
//                                               lastStart '2026-09-01', lastEnd '2026-09-30'
//   (1월이면 지난달은 전년도 12월)

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC 필드로 읽은 Date → 'YYYY-MM-DD' */
function formatUtcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → 해당 날짜 UTC 자정의 epoch ms */
function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** timestamp를 KST 벽시계 시각으로 이동한 Date (getUTC*로 읽을 것) */
function toKstShifted(isoTimestamp: string): Date {
  return new Date(new Date(isoTimestamp).getTime() + KST_OFFSET_MS);
}

/** 'YYYY-MM-DD' of the current date in KST */
export function kstToday(): string {
  return formatUtcYmd(new Date(Date.now() + KST_OFFSET_MS));
}

/** ymd ± n days, returns 'YYYY-MM-DD' (calendar math, no timezone issues) */
export function kstAddDays(ymd: string, n: number): string {
  return formatUtcYmd(new Date(ymdToUtcMs(ymd) + n * 24 * 60 * 60 * 1000));
}

/** UTC ISO string of KST 00:00 on ymd — use with .gte() */
export function kstDayStartUtcIso(ymd: string): string {
  return new Date(ymdToUtcMs(ymd) - KST_OFFSET_MS).toISOString();
}

/** UTC ISO string of KST 00:00 on the day AFTER ymd — use with .lt() (exclusive end) */
export function kstDayEndExclusiveUtcIso(ymd: string): string {
  return kstDayStartUtcIso(kstAddDays(ymd, 1));
}

/** KST 'YYYY-MM-DD' of a timestamp string from the DB */
export function kstDateKey(isoTimestamp: string): string {
  return formatUtcYmd(toKstShifted(isoTimestamp));
}

/** KST hour (0-23) and weekday (0=Sun..6=Sat) of a timestamp string */
export function kstHourAndWeekday(isoTimestamp: string): { hour: number; weekday: number } {
  const d = toKstShifted(isoTimestamp);
  return { hour: d.getUTCHours(), weekday: d.getUTCDay() };
}

/** KST month ranges as 'YYYY-MM-DD': this month 1st → today, last month 1st → last day */
export function kstMonthRanges(): { thisStart: string; thisEnd: string; lastStart: string; lastEnd: string } {
  const today = kstToday();
  const [y, m] = today.split('-').map(Number);
  const thisStart = formatUtcYmd(new Date(Date.UTC(y, m - 1, 1)));
  const lastStart = formatUtcYmd(new Date(Date.UTC(y, m - 2, 1)));
  const lastEnd   = kstAddDays(thisStart, -1);
  return { thisStart, thisEnd: today, lastStart, lastEnd };
}
