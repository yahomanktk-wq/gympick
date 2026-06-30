// react-native-view-shot v4.0.3 타입 정의에 pixelRatio가 누락되어 있어 보강.
// 런타임에는 지원되는 옵션이다(안드로이드/ iOS 모두). 타입만 추가한다.
import 'react-native-view-shot';

declare module 'react-native-view-shot' {
  interface CaptureOptions {
    pixelRatio?: number;
  }
}
