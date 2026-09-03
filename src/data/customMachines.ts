import { Machine } from './types';

// =============================================================================
// 노브랜드(CUSTOM) 머신 카탈로그
// -----------------------------------------------------------------------------
// 헬스장에 있는 머신이 짐픽에 등록된 특정 브랜드 제품이 아닐 때, 매니저가
// "비슷한 유형"으로 골라 등록할 수 있는 부위별 범용 항목이다.
// - 실제 제품이 아니므로 브랜드 로고/사진이 없다. MachineCard의 브랜드 자리에는
//   brandLogos에 없는 텍스트라 그대로 'NONE'이 노출된다.
// - brandCopyrightStore.getBrandCopyrightStatus()는 모든 브랜드를 기본 승인
//   처리하므로 저작권 블러 오버레이는 뜨지 않는다. imageUrl이 없어 이미지
//   영역은 빈 흰 배경으로 표시된다(다른 사진 없는 머신과 동일).
// - category 값은 기존 브랜드 머신 데이터(machines.ts)에서 실제로 가장 많이
//   쓰이는 부위별 상위 유형을 그대로 재사용했다 — 검색/필터 문자열이 갈라지지
//   않도록 하기 위함.
// - id 규칙: custom_{targetMuscle 소문자}_{유형 slug}. 절대 재사용/변경 금지
//   (gym_machines 조인 테이블이 이 id를 참조한다).
//
// ⚠️ 2026-09-01부터 원본(source of truth)은 Supabase `machines` 테이블이다.
//   이 배열은 Supabase 조회가 실패했을 때만 쓰이는 로컬 폴백 데이터다
//   (src/lib/db/machines.ts의 fetchMachines() 참고 — 정상 조회 시엔 이 배열을
//   더 이상 강제로 합치지 않는다). 유형을 추가/수정/삭제하려면:
//   1) Supabase `machines` 테이블에서 해당 로우를 직접 추가/수정/삭제
//   2) 이 배열도 동일하게 맞춰서 수정(폴백이 실제 데이터와 어긋나지 않도록)
//   3) src/data/freeWeightsGymVisual.ts의 GYMVISUAL_GIF_IDS도 같이 맞출 것
//      (이 id가 GIF 이미지인지 여부를 판단하는 별도 목록 — 셋 다 항상 1:1로 유지)
//   두 곳이 어긋나면 온라인일 땐 Supabase 값, 오프라인/에러일 땐 이 배열 값이
//   보이게 되어 헷갈릴 수 있으니 항상 같이 갱신할 것.
//
// ⚠️ 2026-09-02: "겹치는 변형도 다 살려서 각각 별도 항목으로 등록" 원칙으로
//   27개 → 43개로 전체 개편(claude 프로젝트 문서 "gymvisual-gif-구매-다운로드-현황.md"
//   참고). Calf Raise / Incline Fly / Hip Press는 구매한 GIF가 없어서 아직 제외.
// =============================================================================

export const CUSTOM_MACHINES: Machine[] = [
  // --- Chest
  { id: 'custom_chest_press',          name: 'CHEST PRESS',                  brand: 'NONE', targetMuscle: 'Chest',    category: 'Chest Press',        exerciseKind: 'machine', isCustom: true },
  { id: 'custom_chest_press_plate',    name: 'CHEST PRESS (PLATE)',          brand: 'NONE', targetMuscle: 'Chest',    category: 'Chest Press',        exerciseKind: 'machine', isCustom: true },
  { id: 'custom_chest_press_lying',    name: 'LYING CHEST PRESS',            brand: 'NONE', targetMuscle: 'Chest',    category: 'Chest Press',        exerciseKind: 'machine', isCustom: true },
  { id: 'custom_chest_fly',            name: 'PEC FLY',                      brand: 'NONE', targetMuscle: 'Chest',    category: 'Fly',                exerciseKind: 'machine', isCustom: true },
  { id: 'custom_chest_incline',        name: 'INCLINE CHEST PRESS',          brand: 'NONE', targetMuscle: 'Chest',    category: 'Incline Press',      exerciseKind: 'machine', isCustom: true },
  { id: 'custom_chest_incline_hammer', name: 'INCLINE CHEST PRESS (HAMMER)', brand: 'NONE', targetMuscle: 'Chest',    category: 'Incline Press',      exerciseKind: 'machine', isCustom: true },
  { id: 'custom_chest_decline',        name: 'DECLINE CHEST PRESS',          brand: 'NONE', targetMuscle: 'Chest',    category: 'Decline Press',      exerciseKind: 'machine', isCustom: true },

  // --- Back
  { id: 'custom_back_pulldown',        name: 'LAT PULLDOWN',                 brand: 'NONE', targetMuscle: 'Back',     category: 'Pull Down',          exerciseKind: 'machine', isCustom: true },
  { id: 'custom_back_pulldown_plate',  name: 'LAT PULLDOWN (PLATE)',         brand: 'NONE', targetMuscle: 'Back',     category: 'Pull Down',          exerciseKind: 'machine', isCustom: true },
  { id: 'custom_back_middle_row',      name: 'SEATED ROW',                   brand: 'NONE', targetMuscle: 'Back',     category: 'Middle Row',         exerciseKind: 'machine', isCustom: true },
  { id: 'custom_back_low_row',         name: 'LOW ROW',                      brand: 'NONE', targetMuscle: 'Back',     category: 'Low Row',            exerciseKind: 'machine', isCustom: true },
  { id: 'custom_back_high_row',        name: 'HIGH ROW',                     brand: 'NONE', targetMuscle: 'Back',     category: 'High Row',           exerciseKind: 'machine', isCustom: true },
  { id: 'custom_back_t_bar',           name: 'T-BAR ROW',                    brand: 'NONE', targetMuscle: 'Back',     category: 'T-Bar',              exerciseKind: 'machine', isCustom: true },
  { id: 'custom_back_t_bar_close_grip',name: 'T-BAR ROW (CLOSE GRIP)',       brand: 'NONE', targetMuscle: 'Back',     category: 'T-Bar',              exerciseKind: 'machine', isCustom: true },
  { id: 'custom_back_pullover',        name: 'PULLOVER',                     brand: 'NONE', targetMuscle: 'Back',     category: 'Pullover',           exerciseKind: 'machine', isCustom: true },
  { id: 'custom_back_chin_dip',        name: 'CHIN DIP',                     brand: 'NONE', targetMuscle: 'Back',     category: 'Chin Dip',           exerciseKind: 'machine', isCustom: true },

  // --- Shoulders
  { id: 'custom_shoulder_press',            name: 'SHOULDER PRESS',         brand: 'NONE', targetMuscle: 'Shoulder', category: 'Shoulder Press',     exerciseKind: 'machine', isCustom: true },
  { id: 'custom_shoulder_press_cable',      name: 'SHOULDER PRESS (CABLE)', brand: 'NONE', targetMuscle: 'Shoulder', category: 'Shoulder Press',     exerciseKind: 'machine', isCustom: true },
  { id: 'custom_shoulder_lateral',          name: 'LATERAL RAISE',          brand: 'NONE', targetMuscle: 'Shoulder', category: 'Raise_Side Lateral', exerciseKind: 'machine', isCustom: true },
  { id: 'custom_shoulder_lateral_plate',    name: 'LATERAL RAISE (PLATE)',  brand: 'NONE', targetMuscle: 'Shoulder', category: 'Raise_Side Lateral', exerciseKind: 'machine', isCustom: true },
  { id: 'custom_shoulder_lateral_standing', name: 'STANDING LATERAL RAISE', brand: 'NONE', targetMuscle: 'Shoulder', category: 'Raise_Side Lateral', exerciseKind: 'machine', isCustom: true },
  { id: 'custom_shoulder_rear_delt',        name: 'REAR DELT FLY',          brand: 'NONE', targetMuscle: 'Shoulder', category: 'Rear Delt',          exerciseKind: 'machine', isCustom: true },

  // --- Arms
  { id: 'custom_arms_biceps',       name: 'BICEP CURL',         brand: 'NONE', targetMuscle: 'Arms', category: 'Biceps',  exerciseKind: 'machine', isCustom: true },
  { id: 'custom_arms_biceps_plate', name: 'BICEP CURL (PLATE)', brand: 'NONE', targetMuscle: 'Arms', category: 'Biceps',  exerciseKind: 'machine', isCustom: true },
  { id: 'custom_arms_triceps',      name: 'TRICEP EXTENSION',   brand: 'NONE', targetMuscle: 'Arms', category: 'Triceps', exerciseKind: 'machine', isCustom: true },

  // --- Legs
  { id: 'custom_leg_press',                 name: 'LEG PRESS',              brand: 'NONE', targetMuscle: 'Leg', category: 'Leg Press',      exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_press_plate',           name: 'LEG PRESS (PLATE)',      brand: 'NONE', targetMuscle: 'Leg', category: 'Leg Press',      exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_curl',                  name: 'LEG CURL',               brand: 'NONE', targetMuscle: 'Leg', category: 'Leg Curl',       exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_curl_kneeling',         name: 'KNEELING LEG CURL',      brand: 'NONE', targetMuscle: 'Leg', category: 'Leg Curl',       exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_curl_seated',           name: 'SEATED LEG CURL',        brand: 'NONE', targetMuscle: 'Leg', category: 'Leg Curl',       exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_extension',             name: 'LEG EXTENSION',          brand: 'NONE', targetMuscle: 'Leg', category: 'Leg Extension',  exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_extension_plate',       name: 'LEG EXTENSION (PLATE)',  brand: 'NONE', targetMuscle: 'Leg', category: 'Leg Extension',  exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_squat_machine',         name: 'SQUAT MACHINE',          brand: 'NONE', targetMuscle: 'Leg', category: 'Squat Machine',  exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_squat_machine_plate',   name: 'SQUAT MACHINE (PLATE)',  brand: 'NONE', targetMuscle: 'Leg', category: 'Squat Machine',  exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_squat_machine_press',   name: 'SQUAT PRESS',            brand: 'NONE', targetMuscle: 'Leg', category: 'Squat Machine',  exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_squat_machine_belt',    name: 'BELT SQUAT',             brand: 'NONE', targetMuscle: 'Leg', category: 'Squat Machine',  exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_inner_outer',           name: 'INNER/OUTER THIGH',      brand: 'NONE', targetMuscle: 'Leg', category: 'Inner Outer',    exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_hack_squat',            name: 'HACK SQUAT',             brand: 'NONE', targetMuscle: 'Leg', category: 'Hack Squat',     exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_hack_squat_sled',       name: 'HACK SQUAT (SLED)',      brand: 'NONE', targetMuscle: 'Leg', category: 'Hack Squat',     exerciseKind: 'machine', isCustom: true },
  { id: 'custom_leg_hack_squat_pendulum',   name: 'PENDULUM SQUAT',         brand: 'NONE', targetMuscle: 'Leg', category: 'Hack Squat',     exerciseKind: 'machine', isCustom: true },

  // --- Glutes
  { id: 'custom_glutes_hip_abduction',   name: 'HIP ABDUCTION',    brand: 'NONE', targetMuscle: 'Glutes', category: 'Hip Abduction', exerciseKind: 'machine', isCustom: true },
  { id: 'custom_glutes_hip_thrust',      name: 'HIP THRUST',       brand: 'NONE', targetMuscle: 'Glutes', category: 'Hip Thrust',    exerciseKind: 'machine', isCustom: true },
  { id: 'custom_glutes_hip_thrust_plate',name: 'HIP THRUST (PLATE)', brand: 'NONE', targetMuscle: 'Glutes', category: 'Hip Thrust',  exerciseKind: 'machine', isCustom: true },
];
