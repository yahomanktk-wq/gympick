import React, { useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * 세로 스크롤 휠 피커 — 가운데 항목이 선택값, 위/아래로 1개씩 미리보기가
 * 걸쳐 보이는 방식(스크롤해서 원하는 항목을 가운데로 오게 하면 선택됨).
 * 인증샷 오버레이 스타일(레이아웃/폰트/색상) 선택에 공용으로 쓰기 위해
 * 별도 컴포넌트로 분리함 — 다른 화면에서도 재사용 가능.
 *
 * 2026-09-05: 항목이 하나 지날 때마다 햅틱(Medium)을 울리고, 각 항목은
 * 컨테이너 가로폭 중앙에 정렬되도록 수정.
 */

export interface WheelPickerItem<T extends string | number> {
  key: T;
  render: (active: boolean) => React.ReactNode;
}

interface VerticalWheelPickerProps<T extends string | number> {
  items: WheelPickerItem<T>[];
  selectedKey: T;
  onChange: (key: T) => void;
  /** 항목 한 개의 높이(px). 위/아래 미리보기 + 가운데 선택 항목, 총 3줄 높이로 표시됨. */
  itemHeight?: number;
}

export default function VerticalWheelPicker<T extends string | number>({
  items,
  selectedKey,
  onChange,
  itemHeight = 30,
}: VerticalWheelPickerProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, items.findIndex(it => it.key === selectedKey));
  const containerHeight = itemHeight * 3;

  // 스크롤 중 몇 번째 항목을 지나고 있는지 추적 — 항목이 바뀔 때마다 햅틱 틱
  const lastTickIndexRef = useRef(selectedIndex);

  // 외부에서 selectedKey가 바뀌면(초기값 세팅 등) 스크롤 위치를 맞춰줌
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
    lastTickIndexRef.current = selectedIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, itemHeight]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y   = e.nativeEvent.contentOffset.y;
    const idx = Math.min(items.length - 1, Math.max(0, Math.round(y / itemHeight)));
    if (idx !== lastTickIndexRef.current) {
      lastTickIndexRef.current = idx;
      // 너무 약하지 않게 Medium 강도로 — 항목 하나 지날 때마다 한 번씩
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [items.length, itemHeight]);

  const settle = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y   = e.nativeEvent.contentOffset.y;
    const idx = Math.min(items.length - 1, Math.max(0, Math.round(y / itemHeight)));
    const item = items[idx];
    if (item && item.key !== selectedKey) onChange(item.key);
    // 계산이 살짝 어긋난 경우 대비해 정확한 스냅 위치로 보정
    scrollRef.current?.scrollTo({ y: idx * itemHeight, animated: true });
  }, [items, itemHeight, selectedKey, onChange]);

  return (
    <View style={{ height: containerHeight, overflow: 'hidden' }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: itemHeight, alignItems: 'center' }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
      >
        {items.map(it => (
          <View key={String(it.key)} style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}>
            {it.render(it.key === selectedKey)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
