import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { C, R } from '../theme';

// ── SegmentedToggle ───────────────────────────────────────────────────────────
// 2026-09-09: '머신,헬스장 찾기' 화면의 머신⇄헬스장, 리스트⇄지도 토글에
// 부드러운 슬라이딩 애니메이션을 적용하기 위한 공용 2단(이상) 토글 컴포넌트.
// 각 옵션의 실제 렌더 크기를 onLayout으로 측정해, 활성 옵션이 바뀔 때 배경
// 인디케이터(하이라이트 pill)가 그 위치/너비로 부드럽게 이동한다.
// 활성 옵션이 없으면(예: 다른 화면으로 전환된 상태) 인디케이터는 투명해진다.

export interface SegmentedToggleOption {
  key:     string;
  active:  boolean;
  onPress: () => void;
  render:  () => React.ReactNode;
}

interface Props {
  options:        SegmentedToggleOption[];
  style?:         StyleProp<ViewStyle>;
  indicatorColor?: string;
}

interface Rect { x: number; width: number; }

export default function SegmentedToggle({ options, style, indicatorColor }: Props) {
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const translateX  = useRef(new Animated.Value(0)).current;
  const widthAnim    = useRef(new Animated.Value(0)).current;
  const opacityAnim  = useRef(new Animated.Value(0)).current;
  const measuredOnce = useRef(false);

  const activeOpt  = options.find(o => o.active);
  const activeRect = activeOpt ? rects[activeOpt.key] : undefined;

  useEffect(() => {
    if (!activeRect) {
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
      return;
    }
    const firstMeasure = !measuredOnce.current;
    measuredOnce.current = true;
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: activeRect.x,
        duration: firstMeasure ? 0 : 220,
        useNativeDriver: false,
      }),
      Animated.timing(widthAnim, {
        toValue: activeRect.width,
        duration: firstMeasure ? 0 : 220,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: firstMeasure ? 0 : 180,
        useNativeDriver: false,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRect?.x, activeRect?.width]);

  return (
    <View style={[st.container, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          st.indicator,
          {
            backgroundColor: indicatorColor ?? C.accent,
            opacity:   opacityAnim,
            width:     widthAnim,
            transform: [{ translateX }],
          },
        ]}
      />
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          activeOpacity={0.8}
          onPress={opt.onPress}
          onLayout={(e: LayoutChangeEvent) => {
            const { x, width } = e.nativeEvent.layout;
            setRects(prev => (
              prev[opt.key]?.x === x && prev[opt.key]?.width === width
                ? prev
                : { ...prev, [opt.key]: { x, width } }
            ));
          }}
        >
          {opt.render()}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    padding: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    borderRadius: R.pill,
  },
});
