import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, R, T } from '../theme';
import { screenPad } from '../theme/responsive';
import { useAuth } from '../context/AuthContext';
import { fetchWorkoutLogs } from '../lib/db';
import { useFetch } from '../lib/useFetch';
import { MOCK_SESSIONS } from '../data/workoutSessions';
import { WorkoutLog } from '../data/types';
import {
  calcWeeklyVolume,
  calcMachineWeightHistory,
  calcMuscleFrequency,
  hasEnoughData,
  calcTopMachines,
  calcMonthlySummary,
} from '../lib/workoutAnalyticsUtils';
import SimpleBarChart from '../components/SimpleBarChart';
import SimpleLineChart from '../components/SimpleLineChart';

// ── Constants ─────────────────────────────────────────────────────────────────

const MUSCLE_FG: Record<string, string> = {
  Chest:          '#5ba4ff',
  Back:           '#a78bfa',
  Legs:           '#fb923c',
  Shoulders:      '#ffd166',
  Arms:           '#06d6a0',
  Core:           '#06d6a0',
  'Full Body':    '#a8dadc',
  'Hip (Glutes)': '#ff9ecd',
  Glutes:         '#ff9ecd',
};

const RANK_EMOJIS = ['🥇', '🥈', '🥉'];

// ── Sub-components (module-level) ─────────────────────────────────────────────

function NavHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.navHeader}>
      <TouchableOpacity style={s.navBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </TouchableOpacity>
      <Text style={s.navTitle}>운동 분석</Text>
      <View style={s.navBtn} />
    </View>
  );
}

function DataBanner() {
  return (
    <View style={s.dataBanner}>
      <Text style={s.dataBannerText}>
        운동 기록이 쌓일수록 더 정확한 분석을 볼 수 있어요 💪
      </Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.sectionCard}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SummaryStatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryCell}>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

function SummaryStat({ sessions, volume, avgSets }: {
  sessions: number;
  volume:   number;
  avgSets:  number;
}) {
  const volTon = volume >= 1000
    ? `${(volume / 1000).toFixed(1)}t`
    : `${Math.round(volume)}kg`;

  return (
    <View style={s.summaryRow}>
      <SummaryStatCell label="총 운동" value={String(sessions)} />
      <View style={s.summaryDivider} />
      <SummaryStatCell label="총 볼륨"  value={volTon} />
      <View style={s.summaryDivider} />
      <SummaryStatCell label="평균 세트" value={String(avgSets)} />
    </View>
  );
}

function MachineChip({
  label,
  selected,
  onPress,
}: {
  label:    string;
  selected: boolean;
  onPress:  () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.machineChip, selected && s.machineChipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.machineChipText, selected && s.machineChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TopMachineRow({
  rank,
  name,
  count,
}: {
  rank:  number;
  name:  string;
  count: number;
}) {
  const emoji = RANK_EMOJIS[rank] ?? null;
  return (
    <View style={s.topMachineRow}>
      <Text style={s.topMachineRank}>
        {emoji ?? `#${rank + 1}`}
      </Text>
      <Text style={s.topMachineName} numberOfLines={1}>{name}</Text>
      <Text style={s.topMachineCount}>{count}회</Text>
    </View>
  );
}

function SkeletonBlock({ height = 140 }: { height?: number }) {
  return <View style={[s.skeleton, { height }]} />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WorkoutAnalyticsScreen() {
  const nav      = useNavigation<any>();
  const { user } = useAuth();
  const userId   = user?.id ?? 'guest';

  const { data: fetchedLogs, loading } = useFetch(
    () => fetchWorkoutLogs(userId),
    [userId],
  );

  const logs: WorkoutLog[] = fetchedLogs?.length ? fetchedLogs : MOCK_SESSIONS;

  // Derived analytics data
  const monthlySummary  = useMemo(() => calcMonthlySummary(logs), [logs]);
  const weeklyVolume    = useMemo(() => calcWeeklyVolume(logs), [logs]);
  const muscleFrequency = useMemo(() => calcMuscleFrequency(logs), [logs]);
  const topMachines     = useMemo(() => calcTopMachines(logs), [logs]);
  const enoughData      = useMemo(() => hasEnoughData(logs), [logs]);

  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  // Auto-select first machine when data arrives
  const effectiveMachineId = selectedMachineId ?? topMachines[0]?.machineId ?? null;

  const machineWeightHistory = useMemo(
    () => (effectiveMachineId ? calcMachineWeightHistory(logs, effectiveMachineId) : []),
    [logs, effectiveMachineId],
  );

  // Convert volume chart data to tonnes
  const volumeChartData = weeklyVolume.map(w => ({
    label: w.weekLabel,
    value: parseFloat((w.volume / 1000).toFixed(2)),
  }));

  const muscleChartData = muscleFrequency.map(m => ({
    label: m.muscle.slice(0, 5),
    value: m.count,
  }));

  const machineLineData = machineWeightHistory.map(h => ({
    label: h.dateLabel,
    value: h.maxWeight,
  }));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <NavHeader onBack={() => nav.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Data insufficiency banner ── */}
        {!enoughData && <DataBanner />}

        {/* ── ① Monthly summary ── */}
        <SectionCard title="이번 달 요약">
          {loading ? (
            <SkeletonBlock height={60} />
          ) : (
            <SummaryStat
              sessions={monthlySummary.totalSessions}
              volume={monthlySummary.totalVolume}
              avgSets={monthlySummary.avgSetsPerSession}
            />
          )}
        </SectionCard>

        {/* ── ② Weekly volume ── */}
        <SectionCard title="주간 볼륨 추이">
          {loading ? (
            <SkeletonBlock />
          ) : (
            <SimpleBarChart
              data={volumeChartData}
              color={C.accent}
              height={140}
              unit="t"
              emptyMessage={
                '아직 데이터가 부족해요.\n7일 이상 운동을 기록하면 그래프가 표시돼요.'
              }
            />
          )}
        </SectionCard>

        {/* ── ③ Machine weight history ── */}
        <SectionCard title="머신별 무게 성장">
          {loading ? (
            <SkeletonBlock height={180} />
          ) : (
            <>
              {/* Machine selector chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.chipScroll}
                contentContainerStyle={s.chipScrollContent}
              >
                {topMachines.map(m => (
                  <MachineChip
                    key={m.machineId}
                    label={m.machineName}
                    selected={effectiveMachineId === m.machineId}
                    onPress={() => setSelectedMachineId(m.machineId)}
                  />
                ))}
              </ScrollView>

              {/* Line chart */}
              <SimpleLineChart
                data={machineLineData}
                color={C.accent}
                height={160}
                unit="kg"
                emptyMessage="선택한 머신의 기록이 부족해요."
              />
            </>
          )}
        </SectionCard>

        {/* ── ④ Muscle frequency ── */}
        <SectionCard title="부위별 운동 비중">
          {loading ? (
            <SkeletonBlock />
          ) : (
            <SimpleBarChart
              data={muscleChartData}
              color={C.accent}
              height={140}
              unit="회"
              emptyMessage="운동 기록이 없어요."
            />
          )}
        </SectionCard>

        {/* ── ⑤ Top machines ── */}
        <SectionCard title="자주 사용한 머신">
          {loading ? (
            <SkeletonBlock height={160} />
          ) : topMachines.length === 0 ? (
            <Text style={s.emptyText}>운동 기록이 없어요.</Text>
          ) : (
            topMachines.map((m, i) => (
              <TopMachineRow
                key={m.machineId}
                rank={i}
                name={m.machineName}
                count={m.usageCount}
              />
            ))
          )}
        </SectionCard>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingHorizontal: screenPad,
    paddingTop:        8,
    paddingBottom:     24,
  },

  // Nav header
  navHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navBtn: {
    width:           40,
    height:          40,
    alignItems:      'center',
    justifyContent:  'center',
  },
  navTitle: {
    flex:       1,
    ...T.section,
    color:      C.text,
    textAlign:  'center',
  },

  // Data banner
  dataBanner: {
    backgroundColor: C.accentBg,
    borderRadius:    R.inner,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom:    16,
    borderWidth:     1,
    borderColor:     C.accent + '40',
  },
  dataBannerText: {
    ...T.label,
    color:      C.accent,
    lineHeight: 20,
  },

  // Section card
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    padding:         16,
    marginBottom:    14,
  },
  sectionTitle: {
    ...T.section,
    color:        C.text,
    marginBottom: 14,
  },

  // Monthly summary
  summaryRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  summaryCell: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  summaryValue: {
    ...T.hero,
    color:      C.text,
    fontWeight: '800',
  },
  summaryLabel: {
    ...T.micro,
    color: C.textSub,
  },
  summaryDivider: {
    width:        1,
    height:       36,
    backgroundColor: C.border,
  },

  // Machine chips
  chipScroll: {
    marginBottom: 12,
  },
  chipScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  machineChip: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      R.pill,
    backgroundColor:   C.surfaceHigh,
    borderWidth:       1,
    borderColor:       C.border,
  },
  machineChipActive: {
    backgroundColor: C.accentBg,
    borderColor:     C.accent,
  },
  machineChipText: {
    ...T.label,
    color: C.textSub,
  },
  machineChipTextActive: {
    color:      C.accent,
    fontWeight: '700',
  },

  // Top machines list
  topMachineRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap:           10,
  },
  topMachineRank: {
    width:      32,
    fontSize:   16,
    textAlign:  'center',
  },
  topMachineName: {
    flex:       1,
    ...T.body,
    color:      C.text,
    fontWeight: '700',
  },
  topMachineCount: {
    ...T.label,
    color:      C.textSub,
    fontWeight: '600',
  },

  // Skeleton
  skeleton: {
    backgroundColor: C.surfaceHigh,
    borderRadius:    R.inner,
  },

  emptyText: {
    ...T.label,
    color:          C.textDim,
    textAlign:      'center',
    paddingVertical: 24,
  },
});
