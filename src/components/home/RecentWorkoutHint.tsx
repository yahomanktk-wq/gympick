// 2026-11-23: '최근 운동일지 참고' 팝업 → 연속 기록 카드 아래 한 줄 안내로 교체
// 오늘 부위와 같은 지난 운동(없으면 가장 최근 운동)을 한 줄로 보여주고, 누르면 요약을 연다.
// 고르는 기준은 기존 팝업과 같다(lib/recentWorkoutPopup.ts).

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';
import { screenPad } from '../../theme/responsive';
import type { WorkoutLog } from '../../data/types';
import { pickRecentWorkoutForPopup } from '../../lib/recentWorkoutPopup';

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor(
    (new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000,
  );
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Props {
  sessions:    WorkoutLog[];
  todayTarget: string | null;
  onOpen:      (session: WorkoutLog) => void;
}

function RecentWorkoutHint({ sessions, todayTarget, onOpen }: Props) {
  const pick = useMemo(() => pickRecentWorkoutForPopup(sessions, todayTarget), [sessions, todayTarget]);
  if (!pick) return null;

  const { session, matchedMuscle } = pick;
  const label = matchedMuscle && todayTarget && todayTarget !== '휴식'
    ? `지난 ${todayTarget} 운동`
    : '지난 운동';

  return (
    <TouchableOpacity
      style={st.row}
      activeOpacity={0.7}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpen(session); }}
    >
      <Text style={st.text} numberOfLines={1}>
        <Text style={st.label}>{label}</Text>
        {`  ·  ${relativeDay(session.date)}${session.gymName ? ` · ${session.gymName}` : ''}`}
      </Text>
      <Ionicons name="chevron-forward" size={13} color={C.textSub} />
    </TouchableOpacity>
  );
}

export default React.memo(RecentWorkoutHint);

const st = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    marginHorizontal:  screenPad,
    marginBottom:      16,
    paddingHorizontal: 4,
  },
  text:  { flex: 1, fontSize: 13, fontWeight: '500', color: C.textSub },
  label: { fontWeight: '700', color: C.text },
});
