import { supabase } from '../supabase';

/** 유저의 헬스장 즐겨찾기 ID 목록을 Supabase에서 불러온다 */
export async function fetchGymFavorites(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('gym_favorites')
      .select('gym_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((r: { gym_id: string }) => r.gym_id);
  } catch (e) {
    if (__DEV__) console.warn('[gymFavorites] fetchGymFavorites 오류:', e);
    return [];
  }
}

/** 헬스장 즐겨찾기 추가 */
export async function addGymFavoriteDB(userId: string, gymId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('gym_favorites')
      .insert({ user_id: userId, gym_id: gymId });
    if (error && error.code !== '23505') throw error; // 23505 = unique_violation (이미 존재)
  } catch (e) {
    if (__DEV__) console.warn('[gymFavorites] addGymFavoriteDB 오류:', e);
  }
}

/** 헬스장 즐겨찾기 제거 */
export async function removeGymFavoriteDB(userId: string, gymId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('gym_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('gym_id', gymId);
    if (error) throw error;
  } catch (e) {
    if (__DEV__) console.warn('[gymFavorites] removeGymFavoriteDB 오류:', e);
  }
}
