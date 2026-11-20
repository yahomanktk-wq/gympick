// 2026-11-21: 홈 상단 연속 운동 기록 카드
// 왼쪽: 단계별 불꽃 + 연속 일수 / 오른쪽: 루틴에 맞춘 체크 줄 (미설정·요일형은 이번 주, 순서형은 이번 루틴)

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { screenPad } from '../../../theme/responsive';
import type { UserSplitConfig, WorkoutLog } from '../../../data/types';
import { buildWorkoutDayMap } from '../../../lib/streak/workoutDays';
import { computeStreakWithSplit } from '../../../lib/streak/computeStreak';
import { buildCheckRow } from '../../../lib/streak/weekChecks';
import { streakStage } from '../../../lib/streak/streakStage';
import StreakVisual from './StreakVisual';
import StreakChecks from './StreakChecks';

interface Props {
  sessions:    WorkoutLog[];
  splitConfig: UserSplitConfig | null;
  onPress?:    () => void;
}

export default function StreakSection({ sessions, splitConfig, onPress }: Props) {
  const days   = useMemo(() => buildWorkoutDayMap(sessions), [sessions]);
  const streak = useMemo(() => computeStreakWithSplit(days, splitConfig), [days, splitConfig]);
  const row    = useMemo(() => buildCheckRow(days, splitConfig), [days, splitConfig]);
  const stage  = streakStage(streak);

  return (
    <TouchableOpacity
      style={st.card}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
    >
      <View style={st.left}>
        <StreakVisual stage={stage} />
        {streak > 0 ? (
          <>
            <Text style={[st.days, stage === 3 && st.daysHot]}>{streak}일</Text>
            <Text style={st.caption}>연속 운동</Text>
          </>
        ) : (
          <Text style={st.empty}>오늘 시작해볼까요?</Text>
        )}
      </View>
      <StreakChecks row={row} />
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection:    'row',
    alignItems:       'stretch',
    gap:              10,
    marginHorizontal: screenPad,
    marginBottom:     20,
    padding:          10,
    backgroundColor:  C.surface,
    borderRadius:     R.card,
    borderWidth:      1,
    borderColor:      C.borderSub,
  },
  left: {
    width:           100,
    paddingVertical: 10,
    borderRadius:    14,
    backgroundColor: C.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },
  days:    { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginTop: 2 },
  daysHot: { color: C.accent },
  caption: { fontSize: 11, fontWeight: '600', color: C.textSub, marginTop: 1 },
  empty:   { fontSize: 11, fontWeight: '600', color: C.textSub, marginTop: 4, textAlign: 'center', paddingHorizontal: 6 },
});
