import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, LayoutAnimation, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2026-11-07: iOS pageSheet 모달 안에서 키보드에 가려지는 하단 입력칸용.
// KeyboardAvoidingView는 pageSheet 모달(화면 위에서 떨어져 뜨는 시트)에서
// 시트의 위쪽 여백만큼 덜 올려줘서 입력칸이 키보드에 가려진다.
// 앱은 iPhone 전용(supportsTablet: false)이라 시트 아래쪽 = 화면 아래쪽이므로,
// 키보드 높이에서 SafeAreaView가 이미 넣어둔 하단 여백(홈 인디케이터)을 뺀 만큼만 띄운다.
// Android는 시스템이 화면을 줄여주므로 항상 0.

export function useIosKeyboardInset(): number {
  const { bottom } = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    function animate(e: KeyboardEvent) {
      LayoutAnimation.configureNext({
        duration: e.duration > 10 ? e.duration : 250,
        update: { duration: e.duration > 10 ? e.duration : 250, type: LayoutAnimation.Types.keyboard },
      });
    }

    const show = Keyboard.addListener('keyboardWillShow', e => {
      animate(e);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardWillHide', e => {
      animate(e);
      setKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  return Math.max(0, keyboardHeight - bottom);
}
