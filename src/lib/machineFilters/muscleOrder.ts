// 머신 타겟 부위 칩 공용 순서 — CHEST / BACK / LEG / SHOULDER / ARM / GLUTE / OTHER
// (머신 데이터의 부위 값: Chest, Back, Leg, Shoulder, Arms, Glutes, Other)

export const MUSCLE_ORDER = ['Chest', 'Back', 'Leg', 'Shoulder', 'Arms', 'Glutes', 'Other'];

/** 부위 목록을 공용 순서로 정렬. 순서표에 없는 값은 뒤에 알파벳순 */
export function sortMuscles(muscles: Iterable<string>): string[] {
  const unique = [...new Set(muscles)];
  const rank = (m: string) => {
    const i = MUSCLE_ORDER.findIndex(o => o.toLowerCase() === m.toLowerCase());
    return i === -1 ? MUSCLE_ORDER.length : i;
  };
  return unique.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
