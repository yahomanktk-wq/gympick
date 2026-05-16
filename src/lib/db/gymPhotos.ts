import { supabase } from '../supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const BUCKET       = 'gym-photos';

/**
 * 특정 헬스장의 업로드된 사진 public URL 목록 반환
 * 파일명 패턴: {userId}/gym-{gymId}-gym_photo_{timestamp}.jpg
 */
export async function fetchGymPhotoUrls(gymId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 100 });

    if (error || !data) return [];

    const userFolders = data.filter(item => !item.id?.includes('.'));
    const photoUrls: string[] = [];

    await Promise.all(
      userFolders.map(async folder => {
        const { data: files } = await supabase.storage
          .from(BUCKET)
          .list(folder.name, { search: `gym-${gymId}-` });

        if (files?.length) {
          files
            .filter(f => f.name.startsWith(`gym-${gymId}-`))
            .forEach(f => {
              photoUrls.push(
                `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${folder.name}/${f.name}`
              );
            });
        }
      })
    );

    return photoUrls;
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
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(userId, { search: `gym-${gymId}-` });

    if (error || !data?.length) return [];

    return data
      .filter(f => f.name.startsWith(`gym-${gymId}-`))
      .map(f =>
        `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${userId}/${f.name}`
      );
  } catch (e) {
    if (__DEV__) console.warn('[gymPhotos] fetchGymPhotoUrlsByUser error:', e);
    return [];
  }
}
