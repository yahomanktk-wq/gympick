import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';

// 2026-11-09: 어느 헬스장이든 트레이너면 true (프로필 닉네임 옆 'Member' 대신 '트레이너' 배지)
// 프로필 탭에 돌아올 때마다 다시 확인한다 (승인·그만두기 반영).

export function useIsTrainer(userId: string | null | undefined): boolean {
  const [isTrainer, setIsTrainer] = useState(false);
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (!userId) { setIsTrainer(false); return; }
    supabase.from('gym_staff').select('gym_id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(({ count }) => { if (alive) setIsTrainer((count ?? 0) > 0); });
    return () => { alive = false; };
  }, [userId]));
  return isTrainer;
}
