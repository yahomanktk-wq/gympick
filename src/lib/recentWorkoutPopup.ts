import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutLog } from '../data/types';
import { extractCompletedTargets } from './splitUtils';

// 2026-10-16: 로그인 유저가 홈 화면에 들어왔을 때 "이전에 비슷한 부위를 어떻게
// 했었는지" 참고할 수 있도록 가장 최근 운동일지 1건을 팝업으로 보여주기 위한
// 선택 로직 + "오늘 이미 봤는지" 체크. HomeScreen이 이미 들고 있는
// sessions/todayTarget을 그대로 받아서 판단하므로 여기서 추가 네트워크 호출은
// 하지 않는다.

export interface RecentWorkoutPopupPick {
  session: WorkoutLog;
  /** true: 오늘 타겟부위와 겹치는 세션을 찾아서 고름. false: 그런 세션이 없거나
   *  분할 루틴이 설정돼 있지 않아서, 부위 무관 가장 최근 세션으로 대체. */
  matchedMuscle: boolean;
}

/**
 * sessions 중 팝업에 보여줄 1건을 고른다.
 * - todayTargetMuscle(분할 루틴상 오늘 부위, 한글 — getTodayTarget 결과)이 있으면
 *   그 부위를 포함하는 가장 최근 세션을 우선으로 찾는다.
 * - 없거나, 있어도 겹치는 세션이 아직 없으면 부위 무관 가장 최근 세션으로 대체한다.
 * - 오늘 날짜에 이미 기록된 세션은 "참고용"의 의미가 없으므로 후보에서 제외한다.
 * - 작성한 운동일지가 전혀 없으면 null.
 */
export function pickRecentWorkoutForPopup(
  sessions: WorkoutLog[],
  todayTargetMuscle: string | null,
): RecentWorkoutPopupPick | null {
  const todayStr = new Date().toDateString();
  const candidates = sessions
    .filter(s => new Date(s.date).toDateString() !== todayStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (candidates.length === 0) return null;

  if (todayTargetMuscle) {
    const matched = candidates.find(s =>
      extractCompletedTargets(s.machines).includes(todayTargetMuscle)
    );
    if (matched) return { session: matched, matchedMuscle: true };
  }

  return { session: candidates[0], matchedMuscle: false };
}

function seenKey(userId: string): string {
  return `recent_workout_popup_seen_${userId}_${new Date().toDateString()}`;
}

/** 오늘 이 유저에게 이미 팝업을 보여줬는지 */
export async function hasSeenRecentWorkoutPopupToday(userId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(seenKey(userId));
    return v === 'true';
  } catch {
    return false; // 읽기 실패 시 "안 본 것"으로 간주 — 팝업을 못 보여주는 것보단 나은 쪽으로
  }
}

/** 오늘 이 유저에게 팝업을 보여줬다고 기록 */
export async function markRecentWorkoutPopupSeenToday(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(seenKey(userId), 'true');
  } catch {}
}
