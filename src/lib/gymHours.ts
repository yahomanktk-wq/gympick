// 헬스장 영업시간 문자열("월 09:00~22:00, 화 09:00~22:00, ...")을 파싱해서
// 현재 시각 기준으로 영업 중인지 판단하는 유틸.

const HANGUL_DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** "월 09:00~22:00, 화 09:00~22:00, ..." → { '월': '09:00~22:00', ... } */
function parseHoursString(hours: string): Record<string, string> {
  const map: Record<string, string> = {};
  hours.split(',').map(s => s.trim()).filter(Boolean).forEach(seg => {
    const sp = seg.indexOf(' ');
    if (sp < 0) return;
    const label = seg.slice(0, sp).trim();
    const time  = seg.slice(sp + 1).trim();
    if (label) map[label] = time;
  });
  return map;
}

function timeToMinutes(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 29 || min < 0 || min > 59) return null; // allow up to 29:xx for late-night overnight hours if ever used
  return h * 60 + min;
}

/**
 * Returns true if the gym is currently open, based on its `hours` string and
 * the current time. Returns null if `hours` is missing/empty or unparseable
 * for today (caller should treat null as "unknown — don't show a badge").
 */
export function isGymOpenNow(hours: string | undefined | null, now: Date = new Date()): boolean | null {
  if (!hours || !hours.trim()) return null;

  const map = parseHoursString(hours);
  const todayLabel = HANGUL_DAYS[(now.getDay() + 6) % 7]; // getDay(): 0=Sun..6=Sat → map to 월=0..일=6
  const todayRange = map[todayLabel];
  if (!todayRange) return false; // explicitly no hours listed for today = closed (휴무)

  const [startStr, endStr] = todayRange.split('~').map(s => s.trim());
  const start = timeToMinutes(startStr);
  const end   = timeToMinutes(endStr);
  if (start === null || end === null) return null; // unparseable — unknown

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (end > start) {
    // Normal same-day range, e.g. 09:00~22:00
    return nowMinutes >= start && nowMinutes < end;
  } else {
    // Overnight range, e.g. 22:00~02:00 (end time is "past midnight")
    return nowMinutes >= start || nowMinutes < end;
  }
}
