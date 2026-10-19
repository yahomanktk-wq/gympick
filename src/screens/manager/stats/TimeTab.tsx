import React from 'react';
import { View, Text } from 'react-native';
import { DailyUsage, PeakTimeStats } from '../../../lib/db/gymStats';
import StatsBarChart from './StatsBarChart';
import PeakHeatmap from './PeakHeatmap';
import { s } from './statsStyles';

// 매니저 이용 통계 — 시간 탭. 일별 추이 차트 + 요일 × 시간대 히트맵 (F5-3에서 요일별/시간대별 목록을 히트맵으로 교체).

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

      {/* ── 요일 × 시간대 히트맵 (F5-3) ── */}
      <View style={s.card}>
        <Text style={s.chartTitle}>요일 × 시간대 이용</Text>
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <PeakHeatmap grid={peakStats.grid} />
        </View>
      </View>
    </View>
  );
}
