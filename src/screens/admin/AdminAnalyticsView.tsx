import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T, S } from '../../theme';
import { supabase } from '../../lib/supabase';

// --- Types

interface DauRow {
  day: string;
  active_users: number;
}
interface EventRow {
  event_type: string;
  event_count: number;
  unique_users: number;
}
interface RetentionRow {
  signup_day: string;
  cohort_size: number;
  day1_retained: number;
  day7_retained: number;
  day30_retained: number;
}

// --- Small bar chart (no extra chart lib needed — react-native-svg is already installed)

function BarChart({
  data,
  labelKey,
  valueKey,
  color = C.accent,
  height = 160,
}: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <Text style={styles.emptyText}>표시할 데이터가 없어요</Text>;
  }
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  const barGap = 6;
  const barW = Math.max(10, Math.min(28, 280 / data.length - barGap));
  const chartW = data.length * (barW + barGap);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={chartW + 20} height={height + 30}>
        {data.map((d, i) => {
          const v = Number(d[valueKey]) || 0;
          const barH = Math.max(2, (v / max) * height);
          const x = i * (barW + barGap) + 10;
          const y = height - barH;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} />
              <SvgText
                x={x + barW / 2}
                y={height + 14}
                fontSize={9}
                fill={C.textSub}
                textAnchor="middle"
              >
                {String(d[labelKey]).slice(5)}
              </SvgText>
              <SvgText
                x={x + barW / 2}
                y={y - 4}
                fontSize={9}
                fill={C.text}
                textAnchor="middle"
              >
                {v}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Line x1={0} y1={height} x2={chartW + 10} y2={height} stroke={C.border} strokeWidth={1} />
      </Svg>
    </ScrollView>
  );
}

// --- Stat card

function StatCard({ label, value, color = C.text }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// --- Main view

export default function AdminAnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dau, setDau] = useState<DauRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [retention, setRetention] = useState<RetentionRow[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [dauRes, eventsRes, retentionRes] = await Promise.all([
        supabase.from('admin_daily_active_users').select('*').order('day', { ascending: true }).limit(30),
        supabase.from('admin_event_breakdown_30d').select('*').order('event_count', { ascending: false }),
        supabase.from('admin_retention_cohort').select('*').order('signup_day', { ascending: false }).limit(14),
      ]);

      if (dauRes.error) throw dauRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (retentionRes.error) throw retentionRes.error;

      setDau(dauRes.data ?? []);
      setEvents(eventsRes.data ?? []);
      setRetention((retentionRes.data ?? []).reverse());
    } catch (e: any) {
      setError(e?.message ?? '지표를 불러오지 못했어요. 어드민 권한(profiles.role)을 확인해주세요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const todayDau = dau.length ? dau[dau.length - 1].active_users : 0;
  const totalCohort = retention.reduce((sum, r) => sum + r.cohort_size, 0);
  const withCohort = retention.filter(r => r.cohort_size > 0);
  const avgDay7 = withCohort.length
    ? Math.round(
        (withCohort.reduce((sum, r) => sum + r.day7_retained / r.cohort_size, 0) / withCohort.length) * 100
      )
    : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={C.danger} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <View style={styles.statsRow}>
        <StatCard label="오늘 DAU" value={todayDau} color={C.accent} />
        <StatCard label="가입자 (최근 14일 코호트)" value={totalCohort} />
        <StatCard label="평균 7일 리텐션" value={`${avgDay7}%`} color="#3dd68c" />
      </View>

      <Text style={styles.sectionTitle}>일별 활성 유저 (DAU)</Text>
      <View style={styles.chartCard}>
        <BarChart data={dau} labelKey="day" valueKey="active_users" />
      </View>

      <Text style={styles.sectionTitle}>이벤트 브레이크다운 (최근 30일)</Text>
      <View style={styles.chartCard}>
        <BarChart data={events} labelKey="event_type" valueKey="event_count" color="#5ba4ff" />
      </View>

      <Text style={styles.sectionTitle}>코호트 리텐션 (가입일 기준)</Text>
      <View style={styles.tableCard}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.4 }]}>가입일</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>인원</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>1일차</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>7일차</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>30일차</Text>
        </View>
        {retention.length === 0 && <Text style={styles.emptyText}>아직 코호트 데이터가 없어요</Text>}
        {retention.map(r => {
          const pct = (n: number) => (r.cohort_size ? Math.round((n / r.cohort_size) * 100) : 0);
          const d1 = pct(r.day1_retained);
          const d7 = pct(r.day7_retained);
          const d30 = pct(r.day30_retained);
          const colorFor = (p: number) => (p >= 30 ? '#3dd68c' : C.textSub);
          return (
            <View key={r.signup_day} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.4, color: C.text }]}>{r.signup_day}</Text>
              <Text style={styles.tableCell}>{r.cohort_size}</Text>
              <Text style={[styles.tableCell, { color: colorFor(d1) }]}>{d1}%</Text>
              <Text style={[styles.tableCell, { color: colorFor(d7) }]}>{d7}%</Text>
              <Text style={[styles.tableCell, { color: colorFor(d30) }]}>{d30}%</Text>
            </View>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// --- Styles

const styles = StyleSheet.create({
  scroll: { padding: S.md, paddingBottom: S.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.sm, padding: S.lg },
  errorText: { ...T.body, color: C.textSub, textAlign: 'center' },
  emptyText: { ...T.body, color: C.textSub, padding: S.md },

  statsRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.md },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.sm,
  },
  statLabel: { ...T.micro, color: C.textSub, marginBottom: 4 },
  statValue: { ...T.section, color: C.text },

  sectionTitle: { ...T.section, color: C.text, marginTop: S.md, marginBottom: S.sm },

  chartCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.sm,
  },

  tableCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSub,
  },
  tableHeaderRow: { backgroundColor: C.surfaceHigh },
  tableCell: { flex: 1, ...T.body, fontSize: 12, color: C.textSub, textAlign: 'center' },
  tableHeaderText: { color: C.textSub, fontWeight: '700' },
});
