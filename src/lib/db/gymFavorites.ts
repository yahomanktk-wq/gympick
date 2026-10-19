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

// 이 헬스장을 즐겨찾기한 유저 수
// gym_favorites RLS는 본인 행만 노출하므로 직접 count하면 매니저에게 0/1만 보인다.
// 집계 RPC(get_gym_favorite_count, SECURITY DEFINER)는 개수만 반환하고 누가 즐겨찾기했는지는 노출하지 않는다.
export async function fetchGymFavoriteCount(gymId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_gym_favorite_count', { p_gym_id: gymId });
    if (error) { if (__DEV__) console.warn('[gymFavorites] fetchGymFavoriteCount 오류:', error.message); return 0; }
    return typeof data === 'number' ? data : Number(data ?? 0) || 0;
  } catch {
    return 0;
  }
}
