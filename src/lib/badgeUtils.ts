import { WorkoutBadge } from '../data/types';

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

/** 이번 운동 결과로 획득 뱃지 판정 */
export function evaluateBadges(params: {
  streak:     number;       // 현재 연속 운동일수
  prMachines: string[];     // 이번 운동에서 PR 달성한 머신명 배열
}): WorkoutBadge[] {
  const badges: WorkoutBadge[] = [];
  const now = new Date().toISOString();

  // 연속운동 뱃지 — milestone 달성 시 발급
  for (const milestone of STREAK_MILESTONES) {
    if (params.streak === milestone) {
      badges.push({
        id:         `streak_${milestone}_${Date.now()}`,
        type:       'streak',
        label:      `${milestone}일 연속`,
        achievedAt: now,
      });
    }
  }

  // PR 뱃지 — PR 달성한 머신별로 발급
  for (const machineName of params.prMachines) {
    badges.push({
      id:          `pr_${machineName.replace(/\s+/g, '_')}_${Date.now()}`,
      type:        'pr',
      label:       'PR 달성',
      achievedAt:  now,
      machineName,
    });
  }

  return badges;
}

/** 뱃지 누적 목록에 새 뱃지 추가 (같은 milestone streak 중복 제거) */
export function mergeBadges(
  existing: WorkoutBadge[],
  newBadges: WorkoutBadge[],
): WorkoutBadge[] {
  const result = [...existing];

  for (const badge of newBadges) {
    if (badge.type === 'streak') {
      // 같은 milestone이 이미 있으면 스킵
      const alreadyHas = result.some(
        b => b.type === 'streak' && b.label === badge.label,
      );
      if (!alreadyHas) result.push(badge);
    } else {
      // PR 뱃지는 항상 추가
      result.push(badge);
    }
  }

  return result;
}
