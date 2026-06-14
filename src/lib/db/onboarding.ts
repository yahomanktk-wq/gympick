import { supabase } from '../supabase';

export async function fetchWorkoutGuideSeen(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('workout_guide_seen')
      .eq('id', userId)
      .single();
    return !!data?.workout_guide_seen;
  } catch {
    return true; // 조회 실패 시 온보딩 표시하지 않음 (안전)
  }
}

export async function setWorkoutGuideSeen(userId: string, seen: boolean): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ workout_guide_seen: seen })
      .eq('id', userId);
  } catch {
    // 실패해도 무시 (앱 사용에 지장 없도록)
  }
}
