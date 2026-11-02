import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';

// 2026-11-02: 오운완 인증샷 기본 배경.
// 사진을 찍거나 고르지 않아도 운동일지를 저장할 수 있도록, 사진 대신 이 배경 위에
// 레이아웃을 배치해 미리보기·저장한다.
//
// 2026-11-03: 기본 이미지를 남성/여성으로 나눔 (src/assets/ounwan/default-male-N.webp,
//   default-female-N.webp, 3:4).
//   - 운동일지에서 고른 타겟 부위에 엉덩이(Glutes)가 들어 있으면 → 여성 이미지 중 무작위
//   - 그 외 → 남성 이미지 중 무작위
//   운동일지 작성 1회당 한 번 무작위로 정한다 (레이아웃·폰트·색상과 같은 방식).
//   미리보기 위 'AI 가상 이미지' 배지를 탭하면 남녀 구분 없이 전체 중에서 다시 고른다.
//   ▶ 이미지를 추가하려면: 같은 폴더에 3:4 WebP를 넣고 아래 목록에 require 한 줄 추가.
//   목록이 비면 완전한 검정 배경을 쓴다.
//
// 캡처(react-native-view-shot)에 안정적으로 찍히도록 expo-image가 아닌 RN 기본 Image를 쓴다.
export const DEFAULT_OUNWAN_BG_MALE: ImageSourcePropType[] = [
  require('../../../assets/ounwan/default-male-1.webp'),
  require('../../../assets/ounwan/default-male-2.webp'),
  require('../../../assets/ounwan/default-male-3.webp'),
  require('../../../assets/ounwan/default-male-4.webp'),
  require('../../../assets/ounwan/default-male-5.webp'),
  require('../../../assets/ounwan/default-male-6.webp'),
  require('../../../assets/ounwan/default-male-7.webp'),
  require('../../../assets/ounwan/default-male-8.webp'),
  require('../../../assets/ounwan/default-male-9.webp'),
  require('../../../assets/ounwan/default-male-10.webp'),
  require('../../../assets/ounwan/default-male-11.webp'),
  require('../../../assets/ounwan/default-male-12.webp'),
  require('../../../assets/ounwan/default-male-13.webp'),
  require('../../../assets/ounwan/default-male-14.webp'),
  require('../../../assets/ounwan/default-male-15.webp'),
];
export const DEFAULT_OUNWAN_BG_FEMALE: ImageSourcePropType[] = [
  require('../../../assets/ounwan/default-female-1.webp'),
  require('../../../assets/ounwan/default-female-2.webp'),
  require('../../../assets/ounwan/default-female-3.webp'),
  require('../../../assets/ounwan/default-female-4.webp'),
  require('../../../assets/ounwan/default-female-5.webp'),
];
export const DEFAULT_OUNWAN_BG_COLOR = '#000000';

/** 여성 이미지를 쓰는 타겟 부위 (정규화 전·후 이름 모두) */
const FEMALE_BG_MUSCLES = ['Glutes', 'Hip (Glutes)'];

/** 고른 타겟 부위에 엉덩이가 포함되면 여성 기본 이미지를 쓴다 */
export function usesFemaleDefaultBg(muscles: Iterable<string>): boolean {
  for (const m of muscles) if (FEMALE_BG_MUSCLES.includes(m)) return true;
  return false;
}

/**
 * 기본 배경일 때 고를 수 없는 글자색 (배경에 묻혀 안 보이는 색).
 * 현재 이미지가 모두 어두운 톤이라 검정은 계속 뺀다. 밝은 이미지로 바꾸면 이 목록을 조정할 것.
 */
export const COLORS_HIDDEN_ON_DEFAULT_BG: string[] = ['#000000'];

/**
 * 작성 1회당 쓸 기본 배경 번호를 무작위로 고른다.
 * 남성/여성 목록 길이가 달라서 넉넉한 범위의 정수를 뽑고, 그릴 때 목록 길이로 나눈 나머지를 쓴다
 * (타겟 부위가 바뀌어도 같은 번호로 각 목록에서 고르게 고른다).
 */
export function randomDefaultBgIndex(): number {
  return Math.floor(Math.random() * 1_000_000);
}

/** 배지 탭(섞기)용 전체 목록 — 남성 뒤에 여성 */
export const DEFAULT_OUNWAN_BG_ALL: ImageSourcePropType[] = [
  ...DEFAULT_OUNWAN_BG_MALE,
  ...DEFAULT_OUNWAN_BG_FEMALE,
];

/**
 * 지금 보이는 기본 이미지의 전체 목록(DEFAULT_OUNWAN_BG_ALL) 기준 번호.
 * - pickedAll이 있으면(배지를 한 번이라도 탭했으면) 그 번호
 * - 없으면 처음 이미지: 타겟 부위 기준 남/여 목록에서 index로 고른 것
 */
export function currentDefaultBgAllIndex(index: number, female: boolean, pickedAll: number | null | undefined): number {
  const total = DEFAULT_OUNWAN_BG_ALL.length;
  if (pickedAll != null && total > 0) return ((pickedAll % total) + total) % total;
  const list = female ? DEFAULT_OUNWAN_BG_FEMALE : DEFAULT_OUNWAN_BG_MALE;
  const n = list.length;
  if (n === 0) return 0;
  const local = ((index % n) + n) % n;
  return female ? DEFAULT_OUNWAN_BG_MALE.length + local : local;
}

/**
 * 2026-11-03: 배지를 탭하면 남녀 구분 없이 전체 이미지 중 지금과 다른 것을 무작위로 고른다.
 * (처음 보이는 이미지만 타겟 부위 기준 — 엉덩이면 여성, 아니면 남성)
 */
export function nextAnyDefaultBgIndex(currentAll: number): number {
  const n = DEFAULT_OUNWAN_BG_ALL.length;
  if (n <= 1) return currentAll;
  const cur = ((currentAll % n) + n) % n;
  let r = Math.floor(Math.random() * (n - 1));
  if (r >= cur) r += 1;
  return r;
}

/** 사진이 없을 때 인증샷 프레임을 채우는 기본 배경 */
export function DefaultOunwanBackground({ index = 0, female = false, pickedAll = null }: {
  index?: number;
  female?: boolean;
  /** 배지 탭으로 고른 전체 목록 번호 (없으면 타겟 부위 기준 처음 이미지) */
  pickedAll?: number | null;
}) {
  const source = DEFAULT_OUNWAN_BG_ALL.length > 0
    ? DEFAULT_OUNWAN_BG_ALL[currentDefaultBgAllIndex(index, female, pickedAll)]
    : null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: DEFAULT_OUNWAN_BG_COLOR }]}>
      {/* 2026-11-03: require()로 넣은 이미지는 RN이 원본 픽셀 크기(525×700)를 width/height로
          자동 지정해서 absoluteFill만으로는 프레임보다 크게 그려지고 잘렸다 → 100%로 덮어쓴다. */}
      {source ? (
        <Image source={source} style={[StyleSheet.absoluteFill, s.fill]} resizeMode="cover" />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
