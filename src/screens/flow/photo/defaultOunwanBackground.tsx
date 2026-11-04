import React from 'react';
import { View, StyleSheet } from 'react-native';

// 2026-11-02: 오운완 인증샷 기본 배경.
// 사진을 찍거나 고르지 않아도 운동일지를 저장할 수 있도록, 사진 대신 이 배경 위에
// 레이아웃을 배치해 미리보기·저장한다.
//
// 2026-11-04: AI 가상 이미지(default-male/female-N.webp)를 없애고 완전한 검정 배경만 쓴다.
//   운동한 헬스장과 다른 배경이 나와 인증 느낌이 약했기 때문.
//   (기본 이미지 남녀 구분, 'AI 가상 이미지' 배지·섞기 기능도 함께 제거)
export const DEFAULT_OUNWAN_BG_COLOR = '#000000';

/**
 * 기본 배경일 때 고를 수 없는 글자색 (배경에 묻혀 안 보이는 색).
 * 배경이 검정이라 검정 글자색은 뺀다 (무작위 후보와 색상 피커 모두).
 */
export const COLORS_HIDDEN_ON_DEFAULT_BG: string[] = ['#000000'];

/** 사진이 없을 때 인증샷 프레임을 채우는 기본 배경 (검정) */
export function DefaultOunwanBackground() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: DEFAULT_OUNWAN_BG_COLOR }]} />;
}
