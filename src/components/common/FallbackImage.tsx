// FallbackImage — URL 후보 목록을 순서대로 시도하는 expo-image 래퍼.
// 미리 만든 사진 변형(_w1024/_w2048.webp)이 아직 없는 사진(구버전 앱 업로드 등)은
// 첫 URL이 404가 나므로, 실패하면 다음 후보(구 썸네일 → 원본)로 자동 전환한다.

import React, { useState } from 'react';
import { Image, type ImageProps, type ImageErrorEventData } from 'expo-image';

type Props = Omit<ImageProps, 'source'> & {
  /** 우선순위 순서의 이미지 URL 후보 */
  sources: string[];
};

export default function FallbackImage({ sources, onError, ...rest }: Props) {
  const key = sources.join('|');
  // 후보 목록이 바뀌면(리스트 셀 재사용 등) 처음 후보부터 다시 시도
  const [state, setState] = useState({ key, index: 0 });
  const index = state.key === key ? state.index : 0;
  const uri   = sources[index];

  const handleError = (e: ImageErrorEventData) => {
    if (index < sources.length - 1) {
      setState({ key, index: index + 1 });
    } else {
      onError?.(e);
    }
  };

  return (
    <Image
      {...rest}
      source={uri ? { uri } : undefined}
      recyclingKey={rest.recyclingKey ?? uri}
      onError={handleError}
    />
  );
}
