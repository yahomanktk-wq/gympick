// 헬스장 페이지 공유 — 안내 문구 없이 링크(URL)만 OS 공유 시트로 넘긴다.
// gympick.kr 페이지에 OG 태그(제목/이미지)가 있어 카카오톡 등은 URL만으로 미리보기 카드를 보여주고,
// 공유 시트의 "복사"도 URL만 복사된다.
import { Platform, Share } from 'react-native';

export async function shareGymLink(url: string): Promise<void> {
  try {
    // iOS: url만 전달 / Android: message가 필수라 URL만 message로 전달
    await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
  } catch (e) {
    if (__DEV__) console.warn('[share] shareGymLink error:', e);
  }
}
