// 헬스장/머신 보유 정보 공유 유틸
//
// gympick-web(웹 폴백 페이지, gympick.app/gym/{gymId})으로 연결되는 링크를
// 만들고, OS 기본 공유 시트(Share.share)로 공유하는 로직을 모듈화한 파일.
import { Platform, Share } from 'react-native';

export const WEB_FALLBACK_BASE_URL = 'https://gympick.app';

/** 헬스장 보유 머신 웹 폴백 페이지 링크 */
export function getGymShareUrl(gymId: string) {
  return `${WEB_FALLBACK_BASE_URL}/gym/${gymId}`;
}

/**
 * 헬스장 상세보기 화면의 공유 버튼에서 호출.
 * gympick-web의 카카오톡 등 공유 미리보기 문구(제목/설명)와 동일하게 맞춤.
 */
export async function shareGym(gymName: string, gymId: string) {
  const title = `${gymName} 보유머신`;
  const description = "'짐픽'을 통해 보유머신을 확인하세요.";
  const url = getGymShareUrl(gymId);

  try {
    await Share.share(
      Platform.OS === 'ios'
        ? { message: `${title}\n${description}`, url }
        : { message: `${title}\n${description}\n${url}` }
    );
  } catch (e) {
    if (__DEV__) console.warn('[share] shareGym error:', e);
  }
}
