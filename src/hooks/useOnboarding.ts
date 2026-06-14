import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWorkoutGuideSeen, setWorkoutGuideSeen } from '../lib/db/onboarding';
import {
  OnboardingPointKey,
  ONBOARDING_ORDER,
  ONBOARDING_TOTAL,
  ONBOARDING_MESSAGES,
  getOnboardingIndex,
} from '../data/onboardingSteps';
import { SpotlightRect } from '../components/OnboardingTooltip';

export function useOnboarding() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [currentKey, setCurrentKey] = useState<OnboardingPointKey | null>(null);
  const [rects, setRects] = useState<Partial<Record<OnboardingPointKey, SpotlightRect>>>({});
  const checkedRef = useRef(false);

  // 최초 진입 시 플래그 확인
  useEffect(() => {
    if (!user?.id || checkedRef.current) return;
    checkedRef.current = true;
    fetchWorkoutGuideSeen(user.id).then(seen => {
      if (!seen) {
        setActive(true);
        setCurrentKey(ONBOARDING_ORDER[0]);
      }
    });
  }, [user?.id]);

  // 각 Step 컴포넌트에서 요소 위치 등록
  const registerRect = useCallback((key: OnboardingPointKey, rect: SpotlightRect) => {
    setRects(prev => ({ ...prev, [key]: rect }));
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    setCurrentKey(null);
    if (user?.id) setWorkoutGuideSeen(user.id, true);
  }, [user?.id]);

  const next = useCallback(() => {
    if (!currentKey) return;
    const idx = ONBOARDING_ORDER.indexOf(currentKey);
    if (idx >= ONBOARDING_ORDER.length - 1) {
      finish();
      return;
    }
    setCurrentKey(ONBOARDING_ORDER[idx + 1]);
  }, [currentKey, finish]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  // 특정 포인트로 바로 이동 (중간 단계 건너뛰기)
  const jumpTo = useCallback((key: OnboardingPointKey) => {
    if (!active) return;
    setCurrentKey(key);
  }, [active]);

  // 재시작 (프로필에서 "가이드 다시 보기")
  const restart = useCallback(() => {
    setRects({});
    setCurrentKey(ONBOARDING_ORDER[0]);
    setActive(true);
  }, []);

  const currentRect = currentKey ? rects[currentKey] ?? null : null;
  const currentMessage = currentKey ? ONBOARDING_MESSAGES[currentKey] : '';
  const currentIndex = currentKey ? getOnboardingIndex(currentKey) : 0;
  const isLast = currentKey ? ONBOARDING_ORDER.indexOf(currentKey) === ONBOARDING_ORDER.length - 1 : false;

  // 다음/건너뛰기 버튼 숨김 처리할 포인트
  const HIDE_NEXT_KEYS: OnboardingPointKey[] = ['photo-capture', 'photo-camera-hint'];
  const hideNext = currentKey ? HIDE_NEXT_KEYS.includes(currentKey) : false;
  const hideSkip = currentKey === 'photo-camera-hint';
  const hideSpotlightBorder = currentKey === 'photo-capture-done';

  return {
    active,
    currentKey,
    currentRect,
    currentMessage,
    currentIndex,
    total: ONBOARDING_TOTAL,
    isLast,
    hideNext,
    hideSkip,
    hideSpotlightBorder,
    registerRect,
    next,
    skip,
    restart,
    jumpTo,
  };
}
