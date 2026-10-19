import React from 'react';
import { View, Text } from 'react-native';
import { DailyUsage, PeakTimeStats } from '../../../lib/db/gymStats';
import StatsBarChart from './StatsBarChart';
import { s } from './statsStyles';

// 매니저 이용 통계 — 시간 탭 (F5-2). 기존 추이 차트 + 요일별/시간대별 목록을 그대로 이동 (F5-3에서 히트맵으로 교체 예정).

interface Props {
  dailyStats: DailyUsage[];
  peakStats:  PeakTimeStats;
}

export default function TimeTab({ dailyStats, peakStats }: Props) {
  return (
    <View style={{ gap: 16 }}>
      {/* ── 추이 차트 ── */}
      <View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>총 운동 세션</Text>
          <Text style={s.summaryValue}>{dailyStats.reduce((sum, d) => sum + d.count, 0)}회</Text>
        </View>
        <View style={s.card}>
          <Text style={s.chartTitle}>일별 운동 횟수</Text>
          <StatsBarChart data={dailyStats} />
        </View>
      </View>

      {/* ── 피크타임 ── */}
      <View style={{ gap: 16 }}>
        {/* 요일별 */}
        <View style={s.card}>
          <Text style={s.chartTitle}>요일별 이용 현황</Text>
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => {
            const count  = peakStats.byDayOfWeek[i] ?? 0;
            const maxVal = Math.max(...Object.values(peakStats.byDayOfWeek), 1);
            return (
              <View key={i} style={[s.peakRow, i > 0 && s.divider]}>
                <Text style={s.peakLabel}>{day}</Text>
                <View style={s.peakBarWrap}>
                  <View style={[s.peakBar, { width: `${(count / maxVal) * 100}%` }]} />
                </View>
                <Text style={s.peakCount}>{count}회</Text>
              </View>
            );
          })}
        </View>

        {/* 시간대별 */}
        <View style={s.card}>
          <Text style={s.chartTitle}>시간대별 이용 현황</Text>
          {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map((h, idx) => {
            const count  = peakStats.byHour[h] ?? 0;
            const maxVal = Math.max(...Object.values(peakStats.byHour), 1);
            return (
              <View key={h} style={[s.peakRow, idx > 0 && s.divider]}>
                <Text style={s.peakLabel}>{`${h}시`}</Text>
                <View style={s.peakBarWrap}>
                  <View style={[s.peakBar, { width: `${(count / maxVal) * 100}%` }]} />
                </View>
                <Text style={s.peakCount}>{count}회</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
