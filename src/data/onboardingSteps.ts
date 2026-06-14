// 운동일지 작성 흐름 전체 온보딩 포인트 정의
// 각 Step 컴포넌트에서 이 키들을 사용해 포인트 등록/표시

export type OnboardingPointKey =
  | 'gym-list'
  | 'gym-request-link'
  | 'muscle-grid'
  | 'routine-new'
  | 'routine-past'
  | 'routine-recommended'
  | 'machine-list'
  | 'machine-add-toggle'
  | 'exercise-grid'
  | 'set-input'
  | 'set-add-copy'
  | 'set-note'
  | 'photo-capture'
  | 'photo-camera-hint'
  | 'photo-capture-done'
  | 'photo-overlay'
  | 'photo-color'
  | 'photo-save-share'
  | 'workout-save';

export const ONBOARDING_MESSAGES: Record<OnboardingPointKey, string> = {
  'gym-list':            '오늘 운동한 헬스장을 선택하면 운동 기록이 시작돼요!',
  'gym-request-link':    '다니는 헬스장이 없다면 여기서 등록을 요청할 수 있어요',
  'muscle-grid':         '오늘 운동한 부위를 선택하세요.\n(아직은 한 가지 부위만 가능해요!)',
  'routine-new':         '머신을 처음부터 직접 골라 새로운 루틴을 만들 수 있어요',
  'routine-past':        '예전에 기록한 운동이 있다면 그대로 다시 불러올 수 있어요',
  'routine-recommended': '헬스장에서 추천 루틴을 등록했다면 참고할 수 있어요',
  'machine-list':        '순서를 바꾸거나 필요 없는 머신은 제거할 수 있어요',
  'machine-add-toggle':  '운동할 머신을 더 추가하고 싶다면 여기를 눌러요',
  'exercise-grid':       '운동한 머신을 선택해서 세트를 기록해요',
  'set-input':           '무게와 횟수를 입력하고 세트를 기록하세요',
  'set-add-copy':        '세트를 추가하거나, 이전 세트 값을 그대로 복사할 수 있어요',
  'set-note':            '운동하면서 기억할 내용을 메모해두세요. 그립, 시트 조절 등 나만의 팁을 남길 수 있어요.',
  'photo-capture':       '오늘의 운동을 인증샷으로 남겨보세요! 화면을 탭해서 사진을 선택하거나 카메라로 촬영해보세요.',
  'photo-camera-hint':   '화면을 탭하면 사진이 촬영돼요!',
  'photo-capture-done':  '인증샷이 적용됐어요! 아래에서 스타일을 꾸며보세요.',
  'photo-overlay':       '인증샷 디자인 스타일을 선택할 수 있어요',
  'photo-color':         '인증샷에 들어갈 글자 색을 바꿀 수 있어요',
  'photo-save-share':    '인증샷을 갤러리에 저장하거나 인스타그램에 공유해요',
  'workout-save':        '마지막으로 눌러서 오늘의 운동 기록을 완료하세요',
};

// 전체 순서 (진행 표시 N/15 기준)
export const ONBOARDING_ORDER: OnboardingPointKey[] = [
  'gym-list',
  'gym-request-link',
  'muscle-grid',
  'routine-new',
  'routine-past',
  'routine-recommended',
  'machine-list',
  'machine-add-toggle',
  'exercise-grid',
  'set-input',
  'set-add-copy',
  'set-note',
  'photo-capture',
  'photo-camera-hint',
  'photo-capture-done',
  'photo-overlay',
  'photo-color',
  'photo-save-share',
  'workout-save',
];

export const ONBOARDING_TOTAL = ONBOARDING_ORDER.length;

export function getOnboardingIndex(key: OnboardingPointKey): number {
  return ONBOARDING_ORDER.indexOf(key) + 1; // 1-based
}
