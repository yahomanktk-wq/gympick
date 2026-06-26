import { supabase } from '../supabase';
import { SplitType, WorkoutSplit, WeekdaySplit, UserSplitConfig } from '../../data/types';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function migrateLegacyWeekdaySplit(raw: any): WeekdaySplit {
  const result: any = {};
  for (const day of WEEKDAY_KEYS) {
    const val = raw[day];
    if (Array.isArray(val))          result[day] = val;
    else if (typeof val === 'string') result[day] = val ? [val] : [];
    else                              result[day] = [];
  }
  return result as WeekdaySplit;
}

// 레거시 순차 분할(string[]) → string[][] 변환. 이미 string[][]이면 그대로.
function migrateLegacySequentialSplit(raw: any): string[][] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => {
      if (Array.isArray(item)) return item.filter((x: any) => typeof x === 'string');
      if (typeof item === 'string') return item ? [item] : [];
      return [];
    })
    .filter((slot: string[]) => slot.length > 0);
}

export async function fetchSplitConfig(userId: string): Promise<UserSplitConfig | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('split_type, workout_split, split_current_index')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  const splitType = (data.split_type ?? 'sequential') as SplitType;
  let workoutSplit = (data.workout_split ?? []) as WorkoutSplit;

  if (splitType === 'weekday' && workoutSplit && !Array.isArray(workoutSplit)) {
    workoutSplit = migrateLegacyWeekdaySplit(workoutSplit);
  }
  if (splitType === 'sequential' && Array.isArray(workoutSplit)) {
    workoutSplit = migrateLegacySequentialSplit(workoutSplit) as unknown as WorkoutSplit;
  }

  return {
    splitType,
    workoutSplit,
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
