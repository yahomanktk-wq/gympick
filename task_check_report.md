# GymPick 기능 검증 보고서
생성일시: 2026-04-14

---

## 1. TypeScript 컴파일 결과

### 초기 오류 (4종 → 자동 수정 완료)

| 파일 | 오류 내용 |
|------|-----------|
| `src/screens/FindGymScreen.tsx:293` | Block-scoped variable 'filteredMachines' used before its declaration |
| `src/screens/flow/GymDetailModal.tsx` (다수) | Parameter implicitly has 'any' type / 'unknown' not assignable to ReactNode |
| `src/lib/photoOverlayUtils.ts` | RefObject\<View \| null\> not assignable to RefObject\<View\> |
| `src/components/OverlayCompositeView.tsx` | RefObject\<View \| null\> not assignable to RefObject\<View\> |

### 수정 후 결과

✅ **TypeScript 오류 없음** (exit code 0)

---

## 2. 파일 존재 여부

### task_1 관련
- ✅ `src/data/workoutFeed.ts`
- ✅ `src/lib/feedUtils.ts`
- ✅ `src/components/WorkoutFeedCard.tsx`
- ✅ `src/screens/WorkoutFeedScreen.tsx`

### task_2 관련
- ✅ `src/lib/machineLevelUtils.ts`
- ✅ `src/data/machineLevelStore.ts`
- ✅ `src/components/MachineLevelBadge.tsx`
- ✅ `src/components/MachineCardWithLevel.tsx`
- ✅ `src/components/XPGainPopup.tsx`

### task_3 관련
- ✅ `src/components/MuscleHeatmap.tsx`
- ✅ `src/components/WorkoutBadge.tsx`
- ✅ `src/components/OverlayPickerSheet.tsx`
- ✅ `src/components/OverlayCompositeView.tsx`
- ✅ `src/lib/photoOverlayUtils.ts`
- ✅ `src/lib/badgeUtils.ts`
- ✅ `src/data/badgeStore.ts`

### task_4 관련
- ✅ `src/lib/workoutAnalyticsUtils.ts`
- ✅ `src/components/SimpleBarChart.tsx`
- ✅ `src/components/SimpleLineChart.tsx`
- ✅ `src/screens/WorkoutAnalyticsScreen.tsx`

### task_5 관련
- ✅ `src/data/machineRankingStore.ts`
- ✅ `src/components/MachineRankingCard.tsx`
- ✅ `src/screens/MachineRankingScreen.tsx`

---

## 3. 네비게이션 등록 현황

| 화면 | 등록 여부 |
|------|-----------|
| `WorkoutFeed` → WorkoutFeedScreen | ✅ |
| `WorkoutAnalytics` → WorkoutAnalyticsScreen | ✅ |
| `MachineRanking` → MachineRankingScreen | ✅ |

모두 `App.tsx` Stack.Navigator에 정상 등록됨. 탭바 구조 변경 없음.

---

## 4. 핵심 로직 검증 결과

### 4-1. feedUtils.ts
- ✅ `filterActivePosts`: `Date.now() - 24 * 60 * 60 * 1000` 기준 24시간 이내 필터링
- ✅ `toggleReaction`: `prev === key` → 취소(count -1, myReaction=null), 다른 키 → 이전 취소 + 새 키 추가

### 4-2. machineLevelUtils.ts
- ✅ Lv.1→2: 100 XP (`100 + (1-1)*20 = 100`)
- ✅ Lv.10→11: 260+50=310 (+50 구간으로 전환)
- ✅ Lv.30→31: 1260+100=1360 (+100 구간으로 전환)
- ✅ Lv.60→61: 4260+200=4460 (+200 구간으로 전환)
- ✅ `calculateXP`: `Math.floor(params.volume / 100)` (100kg당 1XP)
- ✅ `addXP`: `if (data.level >= 99)` → 즉시 반환, XP 누적 중단
- ✅ `getLevelColor`: 회색(≤10) / 파랑(11~30) / 보라(31~60) / 골드(≥61) 4구간

### 4-3. badgeUtils.ts
- ✅ `STREAK_MILESTONES = [3, 7, 14, 30, 60, 100]` 정확히 일치
- ✅ `mergeBadges`: streak 뱃지 label 기준 중복 제거 (`b.label === badge.label`)

### 4-4. workoutAnalyticsUtils.ts
- ✅ `hasEnoughData`: `dates.size >= 7` (7일 미만 false)
- ✅ `calcWeeklyVolume`: `.slice(-8)` (최근 8주)

### 4-5. MuscleHeatmap.tsx
- ✅ `import Svg, { Path, Ellipse, Rect } from 'react-native-svg'`
- ✅ 7개 부위: CHEST, SHOULDERS, ARMS, LEGS, CORE(OTHER 포함), BACK, GLUTES
- ✅ `activeMuscles` prop 기반 조건부 색상 적용

### 4-6. OverlayCompositeView.tsx
- ✅ `collapsable={false}` 최상위 View에 적용
- ✅ `compositeRef` 외부에서 Props로 전달받는 구조 (내부 정의 없음)

### 4-7. MachineCard.tsx
- ℹ️ git status: `??` (untracked — expo-image 마이그레이션으로 수정됨)
- 수정 내용: `react-native Image` → `expo-image Image`, `contentFit="contain"`, `backgroundColor` style 추가
- 이 수정은 **의도된 변경**이며 기존 레이아웃은 유지됨

### 4-8. HomeScreen.tsx
- ✅ "오늘의 오운완 🔥" 섹션이 주변 헬스장 아래, sessionCard 위에 위치
- ✅ `nav.navigate('WorkoutFeed')` 코드 존재

### 4-9. FindGymScreen.tsx
- ✅ 랭킹 섹션이 ListHeaderComponent 상단 (필터 없을 때) 에 위치
- ✅ `const [rankingMuscle, setRankingMuscle] = useState('CHEST')` 기본값 'CHEST'
- ✅ `nav.navigate('MachineRanking')` 코드 존재

### 4-10. ProfileScreen.tsx
- ✅ "운동 분석" 메뉴 항목 존재
- ✅ `BadgeCollectionSection` 뱃지 컬렉션 섹션 존재
- ✅ `nav.navigate('WorkoutAnalytics')` 코드 존재

### 4-11. PostWorkoutLogModal.tsx
- ✅ `calculateXP`, `addXP` import 및 `handleSaveExercise` 내 호출
- ✅ `OverlayPickerSheet` import 및 return JSX에서 렌더링
- ✅ `evaluateBadges` import 및 `requestSaveWorkout` 내 호출
- ✅ `handleSaveWorkout` 기존 로직 유지, `requestSaveWorkout`으로 래핑

---

## 5. 서브 컴포넌트 위치 문제

검사 대상 6개 파일 전체:
- `src/components/WorkoutFeedCard.tsx` — ✅ 모두 모듈 최상단 정의
- `src/screens/WorkoutFeedScreen.tsx` — ✅ 모두 모듈 최상단 정의
- `src/screens/WorkoutAnalyticsScreen.tsx` — ✅ 모두 모듈 최상단 정의
- `src/screens/MachineRankingScreen.tsx` — ✅ 모두 모듈 최상단 정의
- `src/components/XPGainPopup.tsx` — ✅ 모두 모듈 최상단 정의
- `src/components/OverlayPickerSheet.tsx` — ✅ 모두 모듈 최상단 정의

**한글 IME 버그 유발 요소 없음.**

---

## 6. 자동 수정 완료 항목

| # | 파일 | 수정 내용 |
|---|------|-----------|
| 1 | `src/screens/flow/GymDetailModal.tsx` | `gym` 상태 타입 `any` → `GymWithMachines \| undefined` + import 추가 + DEBUG 로그 제거 |
| 2 | `src/lib/photoOverlayUtils.ts` | `RefObject<View>` → `RefObject<View \| null>` (React 19 호환) |
| 3 | `src/components/OverlayCompositeView.tsx` | `compositeRef: RefObject<View>` → `RefObject<View \| null>` |
| 4 | `src/screens/FindGymScreen.tsx` | `filteredMachines` 선언 전 `useEffect` 참조 오류 → useEffect를 useMemo 선언 이후로 이동 |

---

## 7. 사용자 확인 필요 항목 ⚠️

### 7-1. MachineCard.tsx expo-image 마이그레이션
- **내용**: `react-native`의 `Image` → `expo-image`의 `Image`로 교체됨 (`contentFit="contain"`, `backgroundColor` style)
- **영향**: 기존 레이아웃 유지, WebP/캐시 성능 향상
- **권장**: Expo Go에서 머신 카드 이미지가 정상 표시되는지 확인

### 7-2. GymDetailModal DEBUG 로그 제거
- **내용**: 이전 세션에서 추가된 `console.log('[DEBUG] GymDetail machines[0]:...')` 제거 완료
- **확인**: 실기기에서 Supabase 머신 이미지 URL이 정상 로드되는지 확인 필요

---

## 8. Expo Go 최종 확인 체크리스트

### 홈화면
- [ ] "오늘의 오운완 🔥" 섹션이 주변 헬스장 아래 표시됨
- [ ] 오운완 카드 가로 스크롤 동작
- [ ] "더보기" 탭 시 피드 전체 페이지 이동
- [ ] 피드 페이지 내 헬스장/주변/전국 탭 전환

### 오운완 리액션
- [ ] 💪 🔥 👏 🏆 😤 5개 이모지 표시
- [ ] 리액션 탭 시 수치 증가
- [ ] 같은 리액션 재탭 시 취소

### 머신 레벨
- [ ] 머신카드 우상단에 레벨 뱃지 오버레이 표시
- [ ] 운동 기록 저장 후 XP 획득 팝업 표시
- [ ] 경험치 바 채워지는 애니메이션 동작
- [ ] 레벨업 시 팝업 연출 표시

### 오운완 오버레이
- [ ] 오운완 저장 시 오버레이 선택 바텀시트 표시
- [ ] 히트맵 토글 선택 동작
- [ ] 뱃지 토글 선택 동작
- [ ] 근육 히트맵 SVG 인체 실루엣 표시
- [ ] 운동 부위에 해당하는 근육 색상 강조 표시
- [ ] 프로필 화면 뱃지 컬렉션 표시

### 운동기록 분석
- [ ] 프로필 → "운동 분석" 메뉴 표시
- [ ] 분석 페이지 5개 섹션 표시
- [ ] 주간 볼륨 바 차트 표시
- [ ] 머신 선택 칩 탭 시 라인 차트 전환
- [ ] 데이터 부족 시 안내 문구 표시

### 머신 랭킹
- [ ] FindGymScreen 검색창 아래 랭킹 섹션 표시
- [ ] 부위 칩 탭 시 랭킹 카드 즉시 전환
- [ ] "더보기" 탭 시 전체 랭킹 페이지 이동
- [ ] 전체 랭킹 페이지 ALL/부위별 탭 전환
- [ ] 순위 변동 아이콘(▲▼—) 표시

### 기존 기능 유지
- [ ] 운동 기록 저장 기존 플로우 정상 작동
- [ ] MachineCard 기존 레이아웃 유지 (expo-image 교체 후)
- [ ] 탭바 5개 탭 정상 작동
- [ ] 헬스장 상세 GymDetailModal 정상 작동
