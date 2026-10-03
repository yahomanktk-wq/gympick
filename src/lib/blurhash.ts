// blurhash.ts — 로컬 이미지로부터 blurhash 문자열을 생성하는 얇은 래퍼
//
// 머신 이미지(DB에 미리 저장된 카탈로그)와 달리, 오운완 사진은 유저가 그때그때
// 촬영/업로드하는 이미지라 서버(Edge Function)에서 사후에 디코딩하는 대신
// 앱 안에서 업로드 직전에 바로 계산한다 — 네트워크 왕복이 없어 더 빠르고,
// 기존에 만든 머신용 Edge Function 파이프라인과는 독립적으로 동작한다.
//
// react-native-blurhash는 iOS/Android 네이티브 모듈이라 Expo Go에서는 동작하지
// 않고, Development Build/EAS Build(이 프로젝트가 이미 쓰는 방식)에서만 동작한다.
// 설치: npx expo install react-native-blurhash (설치 후 네이티브 재빌드 필요)

import { Blurhash } from 'react-native-blurhash';

// 4x3 컴포넌트 — 머신 이미지 blurhash와 동일한 조합 (가볍고, 카드형 썸네일
// placeholder 용도로는 색감 구분이 충분함).
const COMPONENTS_X = 4;
const COMPONENTS_Y = 3;

/**
 * 로컬 파일 URI(예: expo-image-manipulator 결과물)로부터 blurhash 문자열을 생성한다.
 * 네이티브 모듈 호출이 실패하더라도(디코딩 불가 포맷 등) 업로드 자체를 막지
 * 않도록 실패 시 undefined를 반환한다 — 이 경우 해당 사진은 기존처럼
 * placeholder 없이 표시될 뿐, 회귀는 아니다.
 */
export async function generatePhotoBlurhash(localUri: string): Promise<string | undefined> {
  try {
    return await Blurhash.encode(localUri, COMPONENTS_X, COMPONENTS_Y);
  } catch (err) {
    if (__DEV__) console.warn('[blurhash] generatePhotoBlurhash failed:', err);
    return undefined;
  }
}
