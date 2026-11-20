// 2026-11-21: 연속 일수 단계별 불꽃 (임시 — 기존 아이콘 + 기본 Animated)
// Lottie 파일을 받으면 이 컴포넌트 안만 교체한다. 단계 구간은 lib/streak/streakStage.ts.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../../theme';
import type { StreakStage } from '../../../lib/streak/streakStage';

interface StageLook {
  icon:      'flame' | 'flame-outline';
  size:      number;
  color:     string;
  glow:      string | null;   // 뒤에 깔리는 은은한 빛
  pulse:     number;          // 숨쉬는 크기 변화 폭 (0이면 정지)
  duration:  number;          // 한 번 숨쉬는 데 걸리는 시간(ms)
}

const LOOKS: Record<StreakStage, StageLook> = {
  0: { icon: 'flame-outline', size: 34, color: C.textDim,     glow: null,          pulse: 0,    duration: 0 },
  1: { icon: 'flame',         size: 36, color: C.warning,     glow: null,          pulse: 0.05, duration: 1400 },
  2: { icon: 'flame',         size: 42, color: '#ff7c47',     glow: '#ff7c4733',   pulse: 0.08, duration: 1100 },
  3: { icon: 'flame',         size: 46, color: C.accent,      glow: C.accentBg,    pulse: 0.1,  duration: 900 },
};

const BOX = 56;

export default function StreakVisual({ stage }: { stage: StreakStage }) {
  const look = LOOKS[stage];
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(1);
    if (look.pulse <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1 + look.pulse, duration: look.duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,              duration: look.duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [stage, look.pulse, look.duration, scale]);

  return (
    <View style={st.box}>
      {look.glow && <View style={[st.glow, { backgroundColor: look.glow }]} />}
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={look.icon} size={look.size} color={look.color} />
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  box:  { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: BOX, height: BOX, borderRadius: BOX / 2 },
});
