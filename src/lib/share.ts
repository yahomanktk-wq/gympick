// 헬스장/머신 보유 정보 공유 유틸
//
// gympick-web(웹 폴백 페이지)으로 연결되는 링크를 만들고, OS 기본 공유
// 시트로 공유하는 로직을 모듈화한 파일 (실제 공유는 shareGymLink.ts).
// 링크 우선순위: gympick.kr/{slug} → gympick.kr/g/{short_code} → gympick.kr/gym/{id}
export const WEB_FALLBACK_BASE_URL = 'https://gympick.kr';

/** 공유 링크를 만드는 데 필요한 헬스장 필드 (slug/short_code는 DB 조회 결과에만 있음) */
export interface GymShareTarget {
  id:          string;
  slug?:       string | null;
  short_code?: string | null;
}

/** 헬스장 보유 머신 웹 폴백 페이지 링크 */
export function getGymShareUrl(gym: GymShareTarget) {
  if (gym.slug) return `${WEB_FALLBACK_BASE_URL}/${gym.slug}`;
  if (gym.short_code) return `${WEB_FALLBACK_BASE_URL}/g/${gym.short_code}`;
  return `${WEB_FALLBACK_BASE_URL}/gym/${gym.id}`;
}
