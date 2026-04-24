import React from 'react';
import { View } from 'react-native';
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
