// 카카오 REST API 키 (하드코딩 — Expo Go 환경변수 런타임 미지원 대응)
const KAKAO_API_KEY = '9f0b2658cebf8693772d95d9f11c697f';

/**
 * 주소 문자열을 카카오 Geocoding API로 위도/경도로 변환한다.
 * 실패하면 null 반환.
 */
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!address.trim()) return null;

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
    });

    if (!res.ok) {
      if (__DEV__) console.warn('[geocoding] 카카오 API 응답 오류:', res.status);
      return null;
    }

    const json = await res.json();
    const doc  = json?.documents?.[0];
    if (!doc) {
      if (__DEV__) console.warn('[geocoding] 주소 검색 결과 없음:', address);
      return null;
    }

    const latitude  = parseFloat(doc.y);
    const longitude = parseFloat(doc.x);
    if (isNaN(latitude) || isNaN(longitude)) return null;

    return { latitude, longitude };
  } catch (e) {
    if (__DEV__) console.warn('[geocoding] 카카오 API 오류:', e);
    return null;
  }
}

/**
 * 두 좌표 사이의 직선 거리를 km 단위로 계산한다 (Haversine 공식).
 */
export function calcDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 거리(km)를 표시용 문자열로 변환한다.
 * 1km 미만이면 "123 m", 이상이면 "1.2 km"
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
