import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OnboardingTooltipProps {
  visible: boolean;
  rect: SpotlightRect | null;
  message: string;
  stepIndex: number;   // 1-based 현재 포인트 번호 (전체 중)
  totalSteps: number;  // 전체 포인트 수
  onNext: () => void;
  onSkip: () => void;
  isLast?: boolean;
  hideNext?: boolean;
  hideSkip?: boolean;
  hideSpotlightBorder?: boolean;
}

const PADDING = 8;
const CARD_MARGIN = 16;

export default function OnboardingTooltip({
  visible,
  rect,
  message,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
  isLast = false,
  hideNext = false,
  hideSkip = false,
  hideSpotlightBorder = false,
}: OnboardingTooltipProps) {
  const fingerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fingerAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(fingerAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, rect]);

  if (!visible || !rect) return null;

  const spot = {
    x: rect.x - PADDING,
    y: rect.y - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  // 카드를 위/아래 중 여유 있는 쪽에 배치
  const spaceAbove = spot.y;
  const spaceBelow = SCREEN_H - (spot.y + spot.height);
  const placeBelow = spaceBelow >= spaceAbove;

  const cardTop = placeBelow
    ? spot.y + spot.height + 12
    : undefined;
  const cardBottom = !placeBelow
    ? SCREEN_H - spot.y + 12
    : undefined;

  const fingerTranslateY = fingerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: placeBelow ? [0, -8] : [0, 8],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* 오버레이 4분할 (스포트라이트 구멍) */}
      {/* 위쪽 */}
      <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(spot.y, 0) }]} pointerEvents="auto" />
      {/* 아래쪽 */}
      <View style={[styles.dim, { top: spot.y + spot.height, left: 0, right: 0, bottom: 0 }]} pointerEvents="auto" />
      {/* 왼쪽 */}
      <View style={[styles.dim, { top: spot.y, left: 0, width: Math.max(spot.x, 0), height: spot.height }]} pointerEvents="auto" />
      {/* 오른쪽 */}
      <View style={[styles.dim, { top: spot.y, left: spot.x + spot.width, right: 0, height: spot.height }]} pointerEvents="auto" />
      {/* 스포트라이트 구멍은 터치 통과 — 하이라이트된 실제 UI를 직접 탭해서
          진행해야 하는 스텝(예: 사진 촬영 탭)이 있어서, 여기만은 막으면 안 된다.
          주변 4분할 dim 뷰만 pointerEvents="auto"로 바깥 영역 터치를 차단한다. */}
      <View
        style={{
          position: 'absolute',
          left: spot.x,
          top: spot.y,
          width: spot.width,
          height: spot.height,
        }}
        pointerEvents="none"
      />

      {/* 스포트라이트 테두리 강조 */}
      {!hideSpotlightBorder && (
        <View
          style={[
            styles.spotlightBorder,
            { left: spot.x, top: spot.y, width: spot.width, height: spot.height },
          ]}
          pointerEvents="none"
        />
      )}

      {/* 손가락 아이콘 */}
      <Animated.View
        style={[
          styles.finger,
          {
            left: spot.x + spot.width / 2 - 14,
            top: placeBelow ? spot.y + spot.height - 6 : spot.y - 22,
            transform: [{ translateY: fingerTranslateY }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="hand-left-outline" size={28} color={C.accent} />
      </Animated.View>

      {/* 설명 카드 */}
      <View
        style={[
          styles.card,
          {
            left: CARD_MARGIN,
            right: CARD_MARGIN,
            top: cardTop,
            bottom: cardBottom,
          },
        ]}
      >
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{stepIndex} / {totalSteps}</Text>
          {!hideSkip && (
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSkip(); }} activeOpacity={0.7}>
              <Text style={styles.skipText}>건너뛰기</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.message}>{message}</Text>

        {!hideNext && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNext(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>{isLast ? '완료' : '다음'}</Text>
            {!isLast && <Ionicons name="arrow-forward" size={16} color={C.bg} />}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: C.accent,
    borderRadius: R.inner,
  },
  finger: {
    position: 'absolute',
    zIndex: 10,
  },
  card: {
    position: 'absolute',
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.accent + '50',
    padding: 16,
    gap: 10,
    zIndex: 20,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: { fontSize: 12, fontWeight: '700', color: C.accent },
  skipText: { fontSize: 12, fontWeight: '600', color: C.textDim },
  message: { fontSize: 14, color: C.text, lineHeight: 20, fontWeight: '600' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 12,
  },
  nextBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },
});
