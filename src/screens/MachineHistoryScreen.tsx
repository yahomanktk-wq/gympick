import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C, R, T } from '../theme';
import { WorkoutLog } from '../data/types';
import { fetchWorkoutLogs } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { perfStart, perfEnd } from '../lib/perf';
import { MOCK_SESSIONS } from '../data/workoutSessions';
import { getNewSessions } from '../data/sessionStore';
import {
  getMachineHistoryPoints,
  getMachineHistorySummary,
  getDateRange,
  PERIOD_FILTERS,
  PeriodFilter,
} from '../lib/machineHistoryUtils';
import HistoryLineChart from '../components/HistoryLineChart';

// ── Helper ────────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PeriodChips({
  active,
  onSelect,
}: {
  active:   PeriodFilter;
  onSelect: (f: PeriodFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipRow}
    >
      {PERIOD_FILTERS.map(f => (
        <TouchableOpacity
          key={f}
          style={[s.chip, active === f && s.chipActive]}
          onPress={() => onSelect(f)}
          activeOpacity={0.75}
        >
          <Text style={[s.chipText, active === f && s.chipTextActive]}>{f}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function SummaryCard({
  totalSessions,
  allTimePR,
  avgVolume,
  totalSets,
  recentTrend,
}: {
  totalSessions: number;
  allTimePR:     number;
  avgVolume:     number;
  totalSets:     number;
  recentTrend:   'up' | 'down' | 'same';
}) {
  const trendIcon  = recentTrend === 'up' ? 'trending-up' : recentTrend === 'down' ? 'trending-down' : 'remove';
  const trendColor = recentTrend === 'up' ? '#4caf50' : recentTrend === 'down' ? '#f44336' : C.textDim;

  return (
    <View style={s.summaryCard}>
      <View style={s.summaryGrid}>
        <View style={s.summaryCell}>
          <Text style={s.summaryVal}>{totalSessions}</Text>
          <Text style={s.summaryLab}>운동 횟수</Text>
        </View>
        <View style={s.summaryCellBorder}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={s.summaryVal}>{allTimePR > 0 ? `${allTimePR}kg` : '--'}</Text>
            <Ionicons name={trendIcon as any} size={14} color={trendColor} />
          </View>
          <Text style={s.summaryLab}>최고 무게(PR)</Text>
        </View>
        <View style={s.summaryCell}>
          <Text style={s.summaryVal}>{avgVolume > 0 ? `${(avgVolume / 1000).toFixed(1)}t` : '--'}</Text>
          <Text style={s.summaryLab}>평균 볼륨</Text>
        </View>
        <View style={s.summaryCellBorder}>
          <Text style={s.summaryVal}>{totalSets}</Text>
          <Text style={s.summaryLab}>총 세트</Text>
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MachineHistoryScreen() {
  const nav   = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const machineId    = route.params?.machineId    ?? '';
  const machineName  = route.params?.machineName  ?? '머신';
  const machineBrand = route.params?.machineBrand ?? '';

  const [sessions,         setSessions]         = useState<WorkoutLog[]>([]);
  const [periodFilter,     setPeriodFilter]     = useState<PeriodFilter>('3개월');
  const [customStart,      setCustomStart]      = useState<Date>(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; });
  const [customEnd,        setCustomEnd]        = useState<Date>(new Date());
  const [showStartPicker,  setShowStartPicker]  = useState(false);
  const [showEndPicker,    setShowEndPicker]    = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      perfStart('MachineHistoryScreen:fetchWorkoutLogs');
      try {
        const logs = await fetchWorkoutLogs(user?.id ?? '');
        if (active) setSessions(logs.length > 0 ? logs : [...getNewSessions(user?.id ?? ''), ...MOCK_SESSIONS]);
      } catch {
        if (active) setSessions([...getNewSessions(user?.id ?? ''), ...MOCK_SESSIONS]);
      } finally {
        perfEnd('MachineHistoryScreen:fetchWorkoutLogs');
      }
    }
    load();
    return () => { active = false; };
  }, [user]));

  const { start, end } = getDateRange(periodFilter, customStart, customEnd);
  const points  = getMachineHistoryPoints(sessions, machineId, start, end);
  const summary = getMachineHistorySummary(points);

  const weightData  = points.map(p => ({ label: p.date, value: p.maxWeight }));
  const volumeData  = points.map(p => ({ label: p.date, value: Math.round(p.totalVolume / 1000 * 10) / 10 }));
  const setsData    = points.map(p => ({ label: p.date, value: p.totalSets }));
  const repsData    = points.map(p => ({ label: p.date, value: p.avgReps }));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{machineName}</Text>
          {!!machineBrand && <Text style={s.headerSub}>{machineBrand}</Text>}
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Period filter chips */}
      <PeriodChips active={periodFilter} onSelect={setPeriodFilter} />

      {/* Custom date range picker */}
      {periodFilter === '직접설정' && (
        <View style={s.dateRangeWrap}>
          <View style={s.dateRangeRow}>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowStartPicker(true)}>
              <Text style={s.dateBtnLabel}>시작일</Text>
              <Text style={s.dateBtnValue}>{formatDate(customStart)}</Text>
            </TouchableOpacity>
            <Text style={s.dateSeparator}>~</Text>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowEndPicker(true)}>
              <Text style={s.dateBtnLabel}>종료일</Text>
              <Text style={s.dateBtnValue}>{formatDate(customEnd)}</Text>
            </TouchableOpacity>
          </View>

          {showStartPicker && (
            <View style={s.datePickerWrap}>
              <DateTimePicker
                value={customStart}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                onChange={(_, date) => {
                  setShowStartPicker(false);
                  if (date) setCustomStart(date);
                }}
                maximumDate={customEnd}
              />
            </View>
          )}

          {showEndPicker && (
            <View style={s.datePickerWrap}>
              <DateTimePicker
                value={customEnd}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                onChange={(_, date) => {
                  setShowEndPicker(false);
                  if (date) setCustomEnd(date);
                }}
                minimumDate={customStart}
                maximumDate={new Date()}
              />
            </View>
          )}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Summary card */}
        <SummaryCard
          totalSessions={summary.totalSessions}
          allTimePR={summary.allTimePR}
          avgVolume={summary.avgVolume}
          totalSets={summary.totalSets}
          recentTrend={summary.recentTrend}
        />

        {/* Empty state */}
        {points.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="bar-chart-outline" size={44} color={C.textDim} />
            <Text style={s.emptyTitle}>이 기간에 기록이 없어요</Text>
            <Text style={s.emptySub}>다른 기간을 선택하거나{'\n'}먼저 운동을 기록해보세요.</Text>
          </View>
        ) : (
          <View style={s.chartsWrap}>
            {/* 1. 최고 무게 */}
            <View style={s.chartCard}>
              <HistoryLineChart
                data={weightData}
                title="최고 무게"
                unit="kg"
                color={C.accent}
              />
            </View>

            <View style={{ height: 24 }} />

            {/* 2. 볼륨 */}
            <View style={s.chartCard}>
              <HistoryLineChart
                data={volumeData}
                title="볼륨"
                unit="t"
                color="#5ba4ff"
              />
            </View>

            <View style={{ height: 24 }} />

            {/* 3. 세트 수 */}
            <View style={s.chartCard}>
              <HistoryLineChart
                data={setsData}
                title="세트 수"
                unit="세트"
                color="#b36bff"
              />
            </View>

            <View style={{ height: 24 }} />

            {/* 4. 평균 횟수 */}
            <View style={s.chartCard}>
              <HistoryLineChart
                data={repsData}
                title="평균 횟수"
                unit="회"
                color="#ff7c47"
              />
            </View>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bg },
  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  backBtn:  { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: R.inner, backgroundColor: C.surface },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  headerSub:   { fontSize: 11, color: C.textSub, marginTop: 1 },

  chipRow:      { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip:         { paddingHorizontal: 16, paddingVertical: 0, borderRadius: R.pill, backgroundColor: C.surface, height: 40, justifyContent: 'center', alignItems: 'center' },
  chipActive:   { backgroundColor: C.accent },
  chipText:     { fontSize: 13, fontWeight: '600', color: C.textSub },
  chipTextActive:{ fontSize: 13, fontWeight: '700', color: C.bg },

  dateRangeWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  datePickerWrap: { marginTop: 8 },
  dateRangeRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBtn:       { flex: 1, backgroundColor: C.surface, borderRadius: R.inner, padding: 12 },
  dateBtnLabel:  { fontSize: 10, color: C.textDim, fontWeight: '600', marginBottom: 3 },
  dateBtnValue:  { fontSize: 13, color: C.text, fontWeight: '700' },
  dateSeparator: { fontSize: 14, color: C.textSub, fontWeight: '700' },

  scroll:    { paddingHorizontal: 16 },

  summaryCard: { backgroundColor: C.surface, borderRadius: R.card, paddingVertical: 16, marginBottom: 20, marginTop: 4 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryCell: { width: '50%', alignItems: 'center', paddingVertical: 10 },
  summaryCellBorder: { width: '50%', alignItems: 'center', paddingVertical: 10, borderLeftWidth: 1, borderLeftColor: C.border },
  summaryVal:  { fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 3 },
  summaryLab:  { fontSize: 10, color: C.textSub, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  emptySub:   { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20 },

  chartsWrap: { },
  chartCard:  { backgroundColor: C.surface, borderRadius: R.card, padding: 16 },
});
