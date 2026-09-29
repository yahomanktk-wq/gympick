import React from 'react';
import { Platform, TextStyle, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** 오버레이 View를 캡처하여 합성된 사진 URI 반환 */
export async function captureWithOverlay(
  viewRef: React.RefObject<View | null>,
): Promise<string> {
  const uri = await captureRef(viewRef as React.RefObject<View>, {
    format:  'jpg',
    quality: 0.92,
  });
  return uri;
}

/**
 * 오운완 오버레이에 쓰이는 장식용 커스텀 폰트(Leorio, GLAMOROUS, Mat Saleh 등)는
 * 실제 Bold 파일이 따로 없는 단일 굵기 폰트다. 이 상태에서 fontWeight를
 * fontFamily와 함께 주면 안드로이드가 해당 굵기의 폰트 변형을 못 찾고 커스텀
 * 폰트 전체를 시스템 폰트(Roboto)로 조용히 바꿔버리는 문제가 있어, 안드로이드에선
 * fontWeight를 비워두는 방식으로 그 문제를 피해왔다(PostWorkoutLogModal 참고).
 *
 * 다만 그 회피책 때문에 같은 폰트인데도 iOS는 두껍게(합성 볼드), 안드로이드는
 * 기본 굵기로만 보이는 시각적 차이가 생긴다. 이 함수는 안드로이드에서만 텍스트
 * 섀도우를 아주 살짝 겹쳐 획을 두껍게 보이게 해 iOS의 볼드 느낌에 가깝게
 * 맞춰준다. iOS에서는 fontWeight가 그대로 적용되므로 빈 객체를 반환한다.
 *
 * 사용법: 기존 스타일 객체에 `...androidFauxBold(tc)`로 스프레드해서 추가한다.
 * (tc = 그 텍스트에 실제 쓰이는 색상 — 섀도우 색을 텍스트 색과 맞춰야 글자
 * 획이 두꺼워지는 것처럼 보이고, 색이 다르면 테두리처럼 붕 떠 보인다.)
 */
export function androidFauxBold(color: string): TextStyle {
  if (Platform.OS !== 'android') return {};
  return {
    textShadowColor:  color,
    textShadowOffset: { width: 0.4, height: 0 },
    textShadowRadius: 0.6,
  };
}
