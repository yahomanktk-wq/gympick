// 2026-11-21: 홈 상단 연속 운동 기록 카드
// 2026-11-23: 왼쪽 칸을 불꽃 → 50단계 단어(Black Han Sans) + 일수로 변경, 카드 높이 축소
// 왼쪽: 단계 단어 + 연속 일수 / 오른쪽: 루틴에 맞춘 체크 줄 (미설정·요일형은 이번 주, 순서형은 이번 루틴)

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { screenPad } from '../../../theme/responsive';
import type { UserSplitConfig, WorkoutLog } from '../../../data/types';
import { buildWorkoutDayMap } from '../../../lib/streak/workoutDays';
import { computeStreakWithSplit } from '../../../lib/streak/computeStreak';
import { buildCheckRow } from '../../../lib/streak/weekChecks';
import { streakLevel, type StreakTone } from '../../../lib/streak/streakLevels';
import StreakChecks from './StreakChecks';

const TONE_COLOR: Record<StreakTone, string> = {
  start:  C.textSub,
  steady: C.text,
  hot:    C.tagMuscle.fg,   // #ff7c47
  legend: C.accent,         // #c8ff57
};

interface Props {
  sessions:    WorkoutLog[];
  splitConfig: UserSplitConfig | null;
  onPress?:    () => void;
}

export default function StreakSection({ sessions, splitConfig, onPress }: Props) {
  const days   = useMemo(() => buildWorkoutDayMap(sessions), [sessions]);
  const streak = useMemo(() => computeStreakWithSplit(days, splitConfig), [days, splitConfig]);
  const row    = useMemo(() => buildCheckRow(days, splitConfig), [days, splitConfig]);
  const level  = streakLevel(streak);

  return (
    <TouchableOpacity
      style={st.card}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
    >
      <View style={st.left} accessible accessibilityLabel={`${level.word}, ${streak}일 연속 운동`}>
        <Text
          style={[st.word, { color: TONE_COLOR[level.tone] }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {level.word}
        </Text>
        <Text style={st.days}>{streak}일</Text>
      </View>
      <StreakChecks row={row} />
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection:    'row',
    alignItems:       'stretch',
    gap:              8,
    marginHorizontal: screenPad,
    marginBottom:     10,
    padding:          8,
    backgroundColor:  C.surface,
    borderRadius:     R.card,
    borderWidth:      1,
    borderColor:      C.borderSub,
  },
  left: {
    width:             100,
    paddingVertical:   8,
    paddingHorizontal: 6,
    borderRadius:      14,
    backgroundColor:   C.surfaceHigh,
    alignItems:        'center',
    justifyContent:    'center',
  },
  word: {
    fontFamily:    'BlackHanSans-Regular',
    fontSize:      40,
    lineHeight:    42,
    letterSpacing: -1,
    textAlign:     'center',
  },
  days: { fontSize: 11, fontWeight: '600', color: C.textSub, marginTop: 1 },
});
