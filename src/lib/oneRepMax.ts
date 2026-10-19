// 2026-10-19 (F3-1): 추정 1RM — 머신 상세 '내 PR'과 (예정된) 헬스장 랭킹이 같은 기준을 쓴다.
// Epley 공식: 1RM = weight × (1 + reps / 30)
//
// 기대값:
//   epley1RM(100, 1)  = 103.33…
//   epley1RM(80, 10)  = 106.67
//   epley1RM(0, 10)   = null   (무게 없음)
//   epley1RM(50, 31)  = null   (30회 초과는 추정치를 신뢰할 수 없음)

/** Epley 추정 1RM. weight<=0 또는 reps<=0 또는 reps>30 이면 null (신뢰할 수 없는 값) */
export function epley1RM(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (weight <= 0 || reps <= 0 || reps > 30) return null;
  return weight * (1 + reps / 30);
}

/** 표시용: 소수 첫째 자리 반올림 (예: 93.3) */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
