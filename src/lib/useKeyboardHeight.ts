import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// 2026-11-09: iOS pageSheet 모달 안에서는 KeyboardAvoidingView가 시트 위치를 잘못 계산해
// 입력칸이 키보드에 가려졌다. 키보드 높이를 직접 받아 아래 여백으로 쓴다.
// Android는 창 크기가 자동으로 줄어들어(adjustResize) 0을 돌려준다.

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', e => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}
