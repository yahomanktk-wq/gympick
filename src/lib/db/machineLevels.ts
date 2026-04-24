import { supabase } from '../supabase';
import { MachineLevelData } from '../../data/types';
import {
  getMachineLevelData as getLocalLevel,
  updateMachineLevelData as updateLocalLevel,
} from '../../data/machineLevelStore';

export async function fetchMachineLevelData(
  machineId: string,
  userId: string,
): Promise<MachineLevelData | null> {
  const { data, error } = await supabase
    .from('machine_levels')
    .select('*')
    .eq('machine_id', machineId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return getLocalLevel(machineId);

  return {
    machineId:        data.machine_id,
    level:            data.level,
    currentXP:        data.current_xp,
    totalXP:          data.total_xp,
    lastUsedAt:       data.last_used_at,
    weeklyUsageCount: data.weekly_usage_count,
  };
}

export async function saveMachineLevelData(
  data: MachineLevelData,
  userId: string,
): Promise<void> {
  updateLocalLevel(data);

  const { error } = await supabase
    .from('machine_levels')
    .upsert({
      machine_id:         data.machineId,
      user_id:            userId,
      level:              data.level,
      current_xp:         data.currentXP,
      total_xp:           data.totalXP,
      last_used_at:       data.lastUsedAt,
      weekly_usage_count: data.weeklyUsageCount,
      updated_at:         new Date().toISOString(),
    });

  if (error && __DEV__) {
    console.warn('[machineLevels] save failed:', error.message);
  }
}
