import { useCallback, useRef, useState } from 'react';
import type { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// FlatList 안의 특정 구역(필터 칩) 위치를 기억하고, 그보다 한참 아래로 내리면 버튼을 보여준다.
const SHOW_AFTER = 480;

export function useScrollToSection<T>() {
  const listRef  = useRef<FlatList<T>>(null);
  const sectionY = useRef(0);
  const [showFab, setShowFab] = useState(false);

  const onSectionLayout = useCallback((e: LayoutChangeEvent) => {
    sectionY.current = e.nativeEvent.layout.y;
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > sectionY.current + SHOW_AFTER;
    setShowFab(prev => (prev === next ? prev : next));
  }, []);

  const scrollToSection = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: Math.max(0, sectionY.current - 8), animated: true });
  }, []);

  return { listRef, onSectionLayout, onScroll, scrollToSection, showFab };
}
