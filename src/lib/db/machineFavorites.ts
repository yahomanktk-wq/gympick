import { supabase } from '../supabase';

// 머신 즐겨찾기 — Supabase 연동 (2026-09-09 추가)
//
// 기존엔 이 파일이 없었고 src/data/favoritesStore.ts가 순수 메모리 배열만 들고 있어서
// 앱을 재시작하면 즐겨찾기가 전부 사라지는 버그가 있었음. gymFavorites.ts(헬스장 즐겨찾기)와
// 동일한 패턴으로 favorite_machines 테이블과 연동한다.
//
// ⚠️ favorite_machines 테이블의 컬럼명이 gym_favorites(user_id, gym_id)와 동일하게
// user_id / machine_id 라고 가정했다. 실제 컬럼명이 다르면 아래 쿼리들이 조용히
// 실패하므로(에러는 __DEV__ 콘솔에만 찍힘), Supabase 테이블 구조를 확인해달라.

/** 유저의 머신 즐겨찾기 ID 목록을 Supabase에서 불러온다 */
export async function fetchFavoriteMachines(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('favorite_machines')
      .select('machine_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((r: { machine_id: string }) => r.machine_id);
  } catch (e) {
    if (__DEV__) console.warn('[machineFavorites] fetchFavoriteMachines 오류:', e);
    return [];
  }
}

/** 머신 즐겨찾기 추가 */
export async function addFavoriteMachineDB(userId: string, machineId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('favorite_machines')
      .insert({ user_id: userId, machine_id: machineId });
    if (error && error.code !== '23505') throw error; // 23505 = unique_violation (이미 존재)
  } catch (e) {
    if (__DEV__) console.warn('[machineFavorites] addFavoriteMachineDB 오류:', e);
  }
}

/** 머신 즐겨찾기 제거 */
export async function removeFavoriteMachineDB(userId: string, machineId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('favorite_machines')
      .delete()
      .eq('user_id', userId)
      .eq('machine_id', machineId);
    if (error) throw error;
  } catch (e) {
    if (__DEV__) console.warn('[machineFavorites] removeFavoriteMachineDB 오류:', e);
  }
}
