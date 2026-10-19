// src/lib/perf.ts
//
// 2026-10-16: 주요 화면 로딩 단계별 소요시간을 개발 중에만 콘솔로 확인하기
// 위한 아주 작은 유틸. __DEV__가 아니면 완전히 no-op이라 배포본에는 전혀
// 영향 없음(코드는 남아있지만 매 호출이 즉시 return). Supabase/PostHog 등
// 어디에도 기록하지 않고 콘솔 로그로만 확인하는 용도(요청하신 범위).
//
// 사용법:
//   perfStart('FindGymScreen:fetchMachines');
//   const data = await fetchMachines();
//   perfEnd('FindGymScreen:fetchMachines');
//   // 콘솔: [PERF] FindGymScreen:fetchMachines: 123ms

const _marks: Map<string, number> = new Map();

export function perfStart(label: string) {
  if (!__DEV__) return;
  _marks.set(label, Date.now());
}

export function perfEnd(label: string, extra?: string) {
  if (!__DEV__) return;
  const start = _marks.get(label);
  if (start == null) return;
  const ms = Date.now() - start;
  _marks.delete(label);
  console.log(`[PERF] ${label}${extra ? ` (${extra})` : ''}: ${ms}ms`);
}
