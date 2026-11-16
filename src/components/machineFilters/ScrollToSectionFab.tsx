import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';

// 2026-11-16: 목록을 많이 내렸을 때 오른쪽 아래에 나타나 필터 칩(보유 머신 선택 맨 위)으로 올려주는 버튼

interface Props {
  visible: boolean;
  onPress: () => void;
}

export default function ScrollToSectionFab({ visible, onPress }: Props) {
  const insets  = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [visible, opacity]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[s.wrap, { bottom: 20 + insets.bottom, opacity }]}
    >
      <TouchableOpacity
        style={s.btn}
        activeOpacity={0.8}
        accessibilityLabel="필터로 이동"
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      >
        <Ionicons name="arrow-up" size={20} color={C.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', right: 16 },
  btn:  {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surfaceHigh, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
});
