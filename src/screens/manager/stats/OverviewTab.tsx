import React from 'react';
import { View, Text } from 'react-native';
import { DailyUsage } from '../../../lib/db/gymStats';
import { s } from './statsStyles';

// 매니저 이용 통계 — 개요 탭 (F5-2). 기간 요약 KPI + 기존 머신 가동률·회원 재방문율 카드(그대로 이동).

interface Props {
  dailyStats:      DailyUsage[];
  memberCount:     number;
  activationStats: { activatedCount: number; totalCount: number; rate: number };
  ownedLoadFailed: boolean;
  retentionStats:  { thisMonth: number; lastMonth: number; retentionRate: number | null; failed: boolean };
}

export default function OverviewTab({ dailyStats, memberCount, activationStats, ownedLoadFailed, retentionStats }: Props) {
  const sessionCount = dailyStats.reduce((sum, d) => sum + d.count, 0);
  return (
    <View style={{ gap: 16 }}>
      {/* 기간 요약 */}
      <View style={s.card}>
        <Text style={s.chartTitle}>기간 요약</Text>
        <View style={s.kpiRow}>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{sessionCount}회</Text>
            <Text style={s.kpiLabel}>운동 세션</Text>
          </View>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{memberCount}명</Text>
            <Text style={s.kpiLabel}>회원</Text>
          </View>
        </View>
      </View>

      {/* 머신 가동률 */}
      <View style={s.card}>
        <Text style={s.chartTitle}>머신 가동률</Text>
        <View style={s.kpiRow}>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{activationStats.rate}%</Text>
            <Text style={s.kpiLabel}>가동률</Text>
          </View>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{activationStats.activatedCount}</Text>
            <Text style={s.kpiLabel}>사용된 머신</Text>
          </View>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{activationStats.totalCount}</Text>
            <Text style={s.kpiLabel}>전체 머신</Text>
          </View>
        </View>
        <View style={[s.usageBarBg, { margin: 16, marginTop: 4, height: 8 }]}>
          <View style={[s.usageBarFill, { width: `${activationStats.rate}%`, height: 8 }]} />
        </View>
        <Text style={[s.machineBrand, { paddingHorizontal: 16, paddingBottom: 14 }]}>
          {ownedLoadFailed
            ? '보유 머신 정보를 불러오지 못했어요.'
            : activationStats.totalCount === 0
              ? '보유 머신이 등록되지 않았어요. 머신 관리에서 먼저 머신을 추가하세요.'
              : `${Math.max(0, activationStats.totalCount - activationStats.activatedCount)}개 머신이 미사용 중입니다`}
        </Text>
      </View>

      {/* 회원 재방문율 */}
      <View style={s.card}>
        <Text style={s.chartTitle}>회원 재방문율 (이번 달 기준)</Text>
        <View style={s.kpiRow}>
          <View style={s.kpiCell}>
            {retentionStats.retentionRate === null
              ? <Text style={[s.kpiValue, { fontSize: 15 }]}>데이터 부족</Text>
              : <Text style={s.kpiValue}>{retentionStats.retentionRate}%</Text>}
            <Text style={s.kpiLabel}>재방문율</Text>
          </View>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{retentionStats.thisMonth}</Text>
            <Text style={s.kpiLabel}>이번 달 회원</Text>
          </View>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{retentionStats.lastMonth}</Text>
            <Text style={s.kpiLabel}>저번 달 회원</Text>
          </View>
        </View>
        <Text style={[s.machineBrand, { paddingHorizontal: 16, paddingBottom: 14 }]}>
          {retentionStats.failed
            ? '재방문 데이터를 불러오지 못했어요.'
            : retentionStats.retentionRate === null
              ? '저번 달 방문 기록이 없어 아직 재방문율을 계산할 수 없어요.'
              : `저번 달 회원 중 ${retentionStats.retentionRate}%가 이번 달에도 방문했습니다`}
        </Text>
      </View>
    </View>
  );
}
