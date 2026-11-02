import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';

// 2026-11-02: 오운완 인증샷 기본 배경.
// 사진을 찍거나 고르지 않아도 운동일지를 저장할 수 있도록, 사진 대신 이 배경 위에
// 레이아웃을 배치해 미리보기·저장한다.
//
// 2026-11-03: 기본 일러스트 4장 적용 (src/assets/ounwan/default-bg-1~4.webp, 3:4).
//   운동일지 작성 1회당 그중 하나를 무작위로 골라 쓴다 (레이아웃·폰트·색상과 같은 방식).
//   ▶ 일러스트를 추가·교체하려면: 같은 폴더에 3:4 WebP를 넣고 아래 목록에 require 한 줄 추가.
//   목록이 비면 완전한 검정 배경을 쓴다.
//
// 캡처(react-native-view-shot)에 안정적으로 찍히도록 expo-image가 아닌 RN 기본 Image를 쓴다.
export const DEFAULT_OUNWAN_BG_IMAGES: ImageSourcePropType[] = [
  require('../../../assets/ounwan/default-bg-1.webp'),
  require('../../../assets/ounwan/default-bg-2.webp'),
  require('../../../assets/ounwan/default-bg-3.webp'),
  require('../../../assets/ounwan/default-bg-4.webp'),
];
export const DEFAULT_OUNWAN_BG_COLOR = '#000000';

/**
 * 기본 배경일 때 고를 수 없는 글자색 (배경에 묻혀 안 보이는 색).
 * 현재 일러스트가 모두 어두운 톤이라 검정은 계속 뺀다. 밝은 일러스트로 바꾸면 이 목록을 조정할 것.
 */
export const COLORS_HIDDEN_ON_DEFAULT_BG: string[] = ['#000000'];

/** 작성 1회당 쓸 기본 배경 번호를 무작위로 고른다 (일러스트가 없으면 0) */
export function randomDefaultBgIndex(): number {
  const n = DEFAULT_OUNWAN_BG_IMAGES.length;
  return n > 0 ? Math.floor(Math.random() * n) : 0;
}

/** 사진이 없을 때 인증샷 프레임을 채우는 기본 배경 */
export function DefaultOunwanBackground({ index = 0 }: { index?: number }) {
  const n = DEFAULT_OUNWAN_BG_IMAGES.length;
  const source = n > 0 ? DEFAULT_OUNWAN_BG_IMAGES[((index % n) + n) % n] : null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: DEFAULT_OUNWAN_BG_COLOR }]}>
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
    </View>
  );
}
