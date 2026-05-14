import { supabase } from '../supabase';
import { SplitType, WorkoutSplit, UserSplitConfig } from '../../data/types';

export async function fetchSplitConfig(userId: string): Promise<UserSplitConfig | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('split_type, workout_split, split_current_index')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    splitType:         (data.split_type ?? 'sequential') as SplitType,
    workoutSplit:      (data.workout_split ?? []) as WorkoutSplit,
    splitCurrentIndex: data.split_current_index ?? 0,
  };
}

export async function saveSplitConfig(
  userId: string,
  splitType: SplitType,
  workoutSplit: WorkoutSplit
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({
      split_type:           splitType,
      workout_split:        workoutSplit,
      split_current_index:  0,
    })
    .eq('id', userId);

  return !error;
}

export async function updateSplitIndex(userId: string, newIndex: number): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ split_current_index: newIndex })
    .eq('id', userId);

  return !error;
}
