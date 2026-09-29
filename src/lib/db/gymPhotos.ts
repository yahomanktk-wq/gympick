import { supabase } from '../supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const BUCKET       = 'gym-photos';

/**
 * 특정 헬스장의 업로드된 사진 public URL 목록 반환.
 *
 * 예전엔 gym-photos 버킷 전체를 폴더별로 훑어보면서(list) 파일명 패턴
 * (`gym-{gymId}-...`)으로 걸러냈는데, 그러려면 storage.objects에 "버킷 전체
 * 목록 조회 허용" 정책이 필요해서 누구나 버킷 안의 모든 유저 폴더/파일명을
 * 긁어갈 수 있는 구멍이 됐다. 지금은 gym_photos 표에 "이 사진은 이 헬스장
 * 것"이라는 매핑을 저장해두고 gym_id로 바로 조회한다 — 그래서 storage 쪽엔
 * 더 이상 목록 조회 권한이 필요 없다.
 */
export async function fetchGymPhotoUrls(gymId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('gym_photos')
      .select('storage_path')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(row => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${row.storage_path}`);
  } catch (e) {
    if (__DEV__) console.warn('[gymPhotos] fetchGymPhotoUrls error:', e);
    return [];
  }
}

/**
 * 특정 유저가 특정 헬스장에 업로드한 사진 URL 목록 반환
 */
export async function fetchGymPhotoUrlsByUser(
  gymId:  string,
  userId: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('gym_photos')
      .select('storage_path')
      .eq('gym_id', gymId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(row => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${row.storage_path}`);
  } catch (e) {
    if (__DEV__) console.warn('[gymPhotos] fetchGymPhotoUrlsByUser error:', e);
    return [];
  }
}

/**
 * gym-photos 버킷에 새로 업로드된 사진을 gym_photos 표에 등록한다 — 업로드
 * 직후 항상 이 함수를 함께 호출해야 fetchGymPhotoUrls()에서 조회된다.
 * storagePath는 버킷 루트 기준 상대 경로(`{userId}/gym-{gymId}-...jpg`).
 */
export async function registerGymPhoto(
  gymId:       string,
  userId:      string,
  storagePath: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from('gym_photos')
    .insert({ gym_id: gymId, user_id: userId, storage_path: storagePath });

  if (error) {
    if (__DEV__) console.warn('[gymPhotos] registerGymPhoto error:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}
