import { WorkoutBadge } from './types';
import { mergeBadges } from '../lib/badgeUtils';

export let userBadges: WorkoutBadge[] = [
  {
    id:         'streak_7_init',
    type:       'streak',
    label:      '7일 연속',
    achievedAt: '2026-04-07T08:00:00Z',
  },
  {
    id:         'pr_bench_init',
    type:       'pr',
    label:      'PR 달성',
    achievedAt: '2026-04-10T09:30:00Z',
    machineName: 'CHEST PRESS',
  },
  {
    id:         'streak_3_init',
    type:       'streak',
    label:      '3일 연속',
    achievedAt: '2026-04-03T07:00:00Z',
  },
  {
    id:         'pr_squat_init',
    type:       'pr',
    label:      'PR 달성',
    achievedAt: '2026-04-12T10:00:00Z',
    machineName: 'LEG PRESS',
  },
];

export function getUserBadges(): WorkoutBadge[] {
  return [...userBadges];
}

export function addBadges(newBadges: WorkoutBadge[]): void {
  userBadges = mergeBadges(userBadges, newBadges);
}
