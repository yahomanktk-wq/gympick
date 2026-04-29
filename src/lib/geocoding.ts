const KAKAO_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';

/**
 * 주소 문자열을 카카오 Geocoding API로 위도/경도로 변환한다.
 * 실패하면 null 반환.
 */
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!address.trim() || !KAKAO_API_KEY) return null;

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const doc  = json?.documents?.[0];
    if (!doc) return null;

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
