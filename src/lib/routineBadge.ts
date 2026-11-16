// 운동 루틴 카드 머리의 부위 배지 (예: "SHOULDER", "CHEST + BACK").
// 2026-11-16: 인증샷 글씨와 같게 — 기록할 때 직접 고른 타겟 부위를 그대로 쓴다.
// 고른 부위가 없는 예전 기록만 기록한 머신들의 부위를 많은 순서로 상위 2개 계산한다.

export function routineBadgeLabel(selectedMuscles: string[] | undefined | null, machineMuscles: string[]): string {
  const chosen = [...new Set((selectedMuscles ?? []).map(m => m.trim()).filter(Boolean))];
  if (chosen.length > 0) return chosen.join(' + ');

  const counts: Record<string, number> = {};
  machineMuscles.filter(Boolean).forEach(m => { counts[m] = (counts[m] ?? 0) + 1; });
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).map(([m]) => m);
  return sorted.length > 1 ? sorted.slice(0, 2).join(' + ') : (sorted[0] ?? 'WORKOUT');
}
