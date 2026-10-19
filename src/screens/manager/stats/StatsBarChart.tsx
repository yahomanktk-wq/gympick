import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../../../theme';
import { DailyUsage } from '../../../lib/db/gymStats';
import { bc, CHART_W, CHART_H } from './statsStyles';

// 매니저 이용 통계 일별 막대 차트 (F5-2: GymStatsView의 BarChart를 그대로 옮김)

export default function StatsBarChart({ data }: { data: DailyUsage[] }) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map(d => d.count), 1);
  const barW = Math.max(2, (CHART_W - 16) / data.length - 2);

  return (
    <View style={bc.wrap}>
      <View style={bc.chart}>
        {data.map((d, i) => (
          <View key={i} style={bc.barCol}>
            <View
              style={[
                bc.bar,
                {
                  width:  barW,
                  height: Math.max(2, (d.count / max) * (CHART_H - 20)),
                  backgroundColor: d.count > 0 ? C.accent : C.border,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={bc.xAxis}>
        <Text style={bc.xLabel}>{data[0]?.date.slice(5)}</Text>
        <Text style={bc.xLabel}>{data[data.length - 1]?.date.slice(5)}</Text>
      </View>
    </View>
  );
}
