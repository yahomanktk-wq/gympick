// freeWeights.ts — shared free-weight exercise list
// Used by PostWorkoutLogModal (member log) and ManagerDashboard (routine builder)
// Supabase machines 테이블과 동기화된 로컬 fallback 데이터
//
// 기존 자체 제작 프리웨이트 44종(fw01~fw44)은 Gym Visual 구매 GIF 129종(fw45~fw173)으로
// 전면 교체되었다 — Supabase `machines` 테이블에서 fw01~44 행이 삭제됨(2026-08-16, 사용자
// 직접 삭제). 로컬 fallback도 DB와 어긋나지 않도록 129종만 유지한다.

import { FREE_WEIGHTS_GYMVISUAL } from './freeWeightsGymVisual';

export interface FreeWeightExercise {
  id: string;
  name: string;
  targetMuscle: string;
  brand: string;
}

export const FREE_WEIGHTS: FreeWeightExercise[] = FREE_WEIGHTS_GYMVISUAL;
