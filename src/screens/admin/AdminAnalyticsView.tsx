import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import {
  fetchCompletionStats,
  fetchSessionAverages,
  fetchTopFavoriteMachines,
  fetchNewVsReturning,
  fetchWeekdayActivity,
  fetchTopGyms,
  fetchAtRiskUsers,
  CompletionStats,
  SessionAverages,
  TopFavoriteMachine,
  NewVsReturning,
  WeekdayActivity,
  TopGym,
  AtRiskUsers,
} from '../../lib/db/adminAnalytics';

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
//
// 2026-09-09: labelKey를 무조건 .slice(5)로 자르던 걸 formatLabel prop으로 분리함.
// 예전엔 DAU 차트("2026-08-09" → "08-09")에 맞춘 처리를 이벤트 브레이크다운
// 차트(event_type 문자열)에도 그대로 적용해서 "app_open"→"pen", "log_set"→"et",
// "view_machine"→"machine"처럼 이벤트 이름이 알아볼 수 없게 잘려 보이던 버그가
// 있었음 — formatLabel을 넘긴 차트만 자르고, 안 넘기면 원본 그대로 표시.
// 막대 폭도 라벨 길이에 맞춰 자동으로 넓어지도록 해서 긴 이벤트 이름도
// 겹치지 않게 함. 또한 가장 높은 막대의 숫자 라벨이 카드 위쪽에서 잘리던
// 문제를 막기 위해 라벨용 상단 여백(topPad)을 추가함.

function BarChart({
  data,
  labelKey,
  valueKey,
  color = C.accent,
  height = 160,
  formatLabel,
  autoScrollToEnd = false,
}: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  height?: number;
  /** 원본 라벨 문자열을 화면에 표시할 형태로 바꾸는 함수. 안 넘기면 원본 그대로 표시. */
  formatLabel?: (raw: string) => string;
  /** true면 차트가 그려지자마자 가로 스크롤을 맨 오른쪽 끝으로 이동시킴.
   *  2026-09-09: DAU처럼 날짜순(오래된→최신) 데이터는 항상 최신 날짜(맨 오른쪽)가
   *  먼저 보이길 원해서 추가 — 기본값 false라 다른 차트(이벤트/요일별)는 그대로 왼쪽부터 시작. */
  autoScrollToEnd?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);

  if (data.length === 0) {
    return <Text style={styles.emptyText}>표시할 데이터가 없어요</Text>;
  }
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  const labelFor = (d: Record<string, any>) => {
    const raw = String(d[labelKey]);
    return formatLabel ? formatLabel(raw) : raw;
  };
  const longestLabelLen = Math.max(...data.map(d => labelFor(d).length), 1);
  const estLabelW = longestLabelLen * 6 + 6; // fontSize 9 기준 대략적인 글자당 폭
  const barGap = 10;
  const barW = Math.max(10, Math.min(60, Math.max(280 / data.length - barGap, estLabelW)));
  const chartW = data.length * (barW + barGap);
  const topPad = 16; // 가장 높은 막대의 숫자 라벨이 잘리지 않도록 확보하는 상단 여백
  const bottomPad = 30; // x축 라벨 공간

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={autoScrollToEnd ? () => scrollRef.current?.scrollToEnd({ animated: false }) : undefined}
    >
      <Svg width={chartW + 20} height={height + topPad + bottomPad}>
        {data.map((d, i) => {
          const v = Number(d[valueKey]) || 0;
          const barH = Math.max(2, (v / max) * height);
          const x = i * (barW + barGap) + 10;
          const y = topPad + (height - barH);
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} />
              <SvgText
                x={x + barW / 2}
                y={topPad + height + 14}
                fontSize={9}
                fill={C.textSub}
                textAnchor="middle"
              >
                {labelFor(d)}
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
        <Line x1={0} y1={topPad + height} x2={chartW + 10} y2={topPad + height} stroke={C.border} strokeWidth={1} />
      </Svg>
    </ScrollView>
  );
}

// --- Funnel (운동일지 작성 단계별 이탈 확인)
//
// 2026-09-09: PostWorkoutLogModal.tsx에 새로 추가한 flow_* 이벤트 6개를
// 기존 이벤트 브레이크다운(admin_event_breakdown_30d)에서 그대로 필터링해
// 순서대로 나열 — 새 VIEW를 만들 필요 없이 이미 불러온 events 배열만 활용.
const FUNNEL_STEPS: { key: string; label: string }[] = [
  { key: 'flow_gym',      label: '헬스장 선택' },
  { key: 'flow_muscle',   label: '부위 선택' },
  { key: 'flow_routine',  label: '루틴 선택' },
  { key: 'flow_machine',  label: '머신 선택' },
  { key: 'flow_setinput', label: '세트 입력' },
  { key: 'flow_photo',    label: '사진 단계' },
];

function FunnelChart({ events }: { events: EventRow[] }) {
  const countFor = (key: string) => events.find(e => e.event_type === key)?.event_count ?? 0;
  const hasAny = FUNNEL_STEPS.some(s => countFor(s.key) > 0);

  if (!hasAny) {
    return <Text style={styles.emptyText}>아직 퍼널 데이터가 없어요 (새로 추가된 지표라 데이터가 쌓이는 중이에요)</Text>;
  }

  const first = countFor(FUNNEL_STEPS[0].key);

  return (
    <View style={styles.tableCard}>
      {FUNNEL_STEPS.map((s, i) => {
        const count = countFor(s.key);
        const pctOfFirst = first > 0 ? Math.round((count / first) * 100) : 0;
        const prevCount = i > 0 ? countFor(FUNNEL_STEPS[i - 1].key) : count;
        const dropPct = i > 0 && prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0;
        return (
          <View key={s.key} style={[styles.funnelRow, i === FUNNEL_STEPS.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.funnelHeaderLine}>
              <Text style={styles.funnelStepLabel}>{i + 1}. {s.label}</Text>
              <Text style={styles.funnelStepCount} numberOfLines={1}>
                {count}회 ({pctOfFirst}%){i > 0 && dropPct > 0 ? ` · 이전 대비 -${dropPct}%` : ''}
              </Text>
            </View>
            <View style={styles.funnelTrack}>
              <View style={[styles.funnelFill, { width: `${Math.max(pctOfFirst, count > 0 ? 2 : 0)}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// --- 주요 버튼 탭 (2026-09-14: 검색/오운완 더보기/운동일지 탭 횟수)
//
// TabNavigator.tsx(FindGym/Journal 탭 tabPress 리스너), HomeScreen.tsx(오운완
// "더보기" 버튼)에서 새로 추가한 이벤트 3개를 기존 이벤트 브레이크다운
// (admin_event_breakdown_30d)에서 그대로 필터링 — 새 VIEW 없이 이미 불러온
// events 배열만 활용(퍼널 섹션과 동일한 패턴).
const KEY_TAP_EVENTS: { key: string; label: string }[] = [
  { key: 'tab_search',  label: '머신·헬스장 검색' },
  { key: 'ounwan_more', label: '오늘의 오운완 더보기' },
  { key: 'tab_journal', label: '운동일지' },
];

// --- Stat card

function StatCard({ label, value, color = C.text }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// --- 가입일 기준 오늘까지 며칠 지났는지 (리텐션 지표가 아직 측정 가능한 시점인지 판단용)
function daysSince(dateStr: string): number {
  const start = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

// --- Main view

export default function AdminAnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dau, setDau] = useState<DauRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [retention, setRetention] = useState<RetentionRow[]>([]);

  // 2026-09-09: 신규 지표 7종 (gympick_admin_analytics_v3_views.sql로 만든 VIEW 조회).
  // 각 fetch* 함수는 VIEW가 없거나 조회 실패 시 자체적으로 빈 기본값을 반환하므로
  // (db/*.ts 모듈들의 공통 패턴) 여기서는 별도 try/catch 없이 그대로 setState.
  const [completion,     setCompletion]     = useState<CompletionStats>({ totalSessions: 0, sessionsWithSets: 0, sessionsWithPhoto: 0 });
  const [averages,       setAverages]       = useState<SessionAverages>({ avgMachines: 0, avgSets: 0, avgVolume: 0 });
  const [topFavorites,   setTopFavorites]   = useState<TopFavoriteMachine[]>([]);
  const [newVsReturning, setNewVsReturning] = useState<NewVsReturning>({ newUsers: 0, returningUsers: 0 });
  const [weekdayActivity, setWeekdayActivity] = useState<WeekdayActivity[]>([]);
  const [topGyms,        setTopGyms]        = useState<TopGym[]>([]);
  const [atRisk,         setAtRisk]         = useState<AtRiskUsers>({ active7d: 0, atRisk7to14d: 0, atRisk14to30d: 0, dormant30dPlus: 0 });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [dauRes, eventsRes, retentionRes, completionData, averagesData, favoritesData, newVsReturningData, weekdayData, topGymsData, atRiskData] = await Promise.all([
        supabase.from('admin_daily_active_users').select('*').order('day', { ascending: true }).limit(30),
        supabase.from('admin_event_breakdown_30d').select('*').order('event_count', { ascending: false }),
        supabase.from('admin_retention_cohort').select('*').order('signup_day', { ascending: false }).limit(14),
        fetchCompletionStats(),
        fetchSessionAverages(),
        fetchTopFavoriteMachines(),
        fetchNewVsReturning(),
        fetchWeekdayActivity(),
        fetchTopGyms(),
        fetchAtRiskUsers(),
      ]);

      if (dauRes.error) throw dauRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (retentionRes.error) throw retentionRes.error;

      setDau(dauRes.data ?? []);
      setEvents(eventsRes.data ?? []);
      setRetention((retentionRes.data ?? []).reverse());

      setCompletion(completionData);
      setAverages(averagesData);
      setTopFavorites(favoritesData);
      setNewVsReturning(newVsReturningData);
      setWeekdayActivity(weekdayData);
      setTopGyms(topGymsData);
      setAtRisk(atRiskData);
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

  const setCompletionPct  = completion.totalSessions > 0 ? Math.round((completion.sessionsWithSets  / completion.totalSessions) * 100) : 0;
  const photoCompletionPct = completion.totalSessions > 0 ? Math.round((completion.sessionsWithPhoto / completion.totalSessions) * 100) : 0;

  const newVsReturningTotal = newVsReturning.newUsers + newVsReturning.returningUsers;
  const returningPct = newVsReturningTotal > 0 ? Math.round((newVsReturning.returningUsers / newVsReturningTotal) * 100) : 0;

  const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
  const weekdayChartData = weekdayActivity.map(w => ({ weekday: WEEKDAY_LABELS[w.weekday] ?? '?', session_count: w.sessionCount }));

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

      <Text style={styles.sectionTitle}>운동일지 완료율 (최근 30일)</Text>
      <View style={styles.statsRow}>
        <StatCard label="세트 기록 완료율" value={`${setCompletionPct}%`} color="#3dd68c" />
        <StatCard label="인증샷 촬영률" value={`${photoCompletionPct}%`} color="#5ba4ff" />
        <StatCard label="작성된 운동일지" value={completion.totalSessions} />
      </View>

      <Text style={styles.sectionTitle}>세션당 평균 지표 (최근 30일)</Text>
      <View style={styles.statsRow}>
        <StatCard label="평균 머신 수" value={averages.avgMachines} />
        <StatCard label="평균 세트 수" value={averages.avgSets} />
        <StatCard label="평균 총 볼륨(kg)" value={averages.avgVolume.toLocaleString()} />
      </View>

      <Text style={styles.sectionTitle}>일별 활성 유저 (DAU)</Text>
      <View style={styles.chartCard}>
        <BarChart data={dau} labelKey="day" valueKey="active_users" formatLabel={(d) => d.slice(5)} autoScrollToEnd />
      </View>

      <Text style={styles.sectionTitle}>주요 버튼 탭 (최근 30일)</Text>
      <View style={styles.statsRow}>
        {KEY_TAP_EVENTS.map(k => (
          <StatCard
            key={k.key}
            label={k.label}
            value={events.find(e => e.event_type === k.key)?.event_count ?? 0}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>신규 vs 재방문 (최근 30일 활동 유저)</Text>
      <View style={styles.statsRow}>
        <StatCard label="신규 유저" value={newVsReturning.newUsers} color={C.accent} />
        <StatCard label="재방문 유저" value={newVsReturning.returningUsers} />
        <StatCard label="재방문 비율" value={`${returningPct}%`} color="#3dd68c" />
      </View>

      <Text style={styles.sectionTitle}>이벤트 브레이크다운 (최근 30일)</Text>
      <View style={styles.chartCard}>
        <BarChart data={events} labelKey="event_type" valueKey="event_count" color="#5ba4ff" />
      </View>
      <View style={[styles.tableCard, { marginTop: S.sm }]}>
        {events.length === 0 && <Text style={styles.emptyText}>아직 이벤트 데이터가 없어요</Text>}
        {events.map((e, i) => (
          <View
            key={e.event_type}
            style={[styles.eventRow, i === events.length - 1 && { borderBottomWidth: 0 }]}
          >
            <Text style={styles.eventName} numberOfLines={1}>{e.event_type}</Text>
            <View style={styles.eventStats}>
              <Text style={styles.eventCount}>{e.event_count}회</Text>
              <Text style={styles.eventUnique}>{e.unique_users}명 이용</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>운동일지 작성 퍼널 (최근 30일)</Text>
      <FunnelChart events={events} />

      <Text style={styles.sectionTitle}>요일별 활동 (최근 30일)</Text>
      <View style={styles.chartCard}>
        <BarChart data={weekdayChartData} labelKey="weekday" valueKey="session_count" color="#f5a623" />
      </View>

      <Text style={styles.sectionTitle}>코호트 리텐션 (가입일 기준)</Text>
      <View style={styles.tableCard}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.2 }]}>가입일</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.7 }]}>인원</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>1일차</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>7일차</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>30일차</Text>
        </View>
        {retention.length === 0 && <Text style={styles.emptyText}>아직 코호트 데이터가 없어요</Text>}
        {retention.map(r => {
          const pct = (n: number) => (r.cohort_size ? Math.round((n / r.cohort_size) * 100) : 0);
          const colorFor = (p: number) => (p >= 30 ? '#3dd68c' : C.textSub);
          const elapsed = daysSince(r.signup_day);

          // 가입 후 해당 일수가 아직 지나지 않은 코호트는 "0%"가 아니라
          // "측정 전"임을 구분해서 보여줌 (예: 어제 가입한 코호트의 30일차는
          // 아직 알 수 없는데 무조건 0%로 보이면 이탈률이 100%인 것처럼 오해됨).
          const renderCell = (n: number, neededDays: number) => {
            if (elapsed < neededDays) {
              return <Text style={[styles.tableCell, styles.tableCellPending]}>측정전</Text>;
            }
            const p = pct(n);
            return (
              <Text style={[styles.tableCell, { color: colorFor(p) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {p}% <Text style={styles.tableCellSub}>({n}/{r.cohort_size})</Text>
              </Text>
            );
          };

          return (
            <View key={r.signup_day} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.2, color: C.text }]}>{r.signup_day}</Text>
              <Text style={[styles.tableCell, { flex: 0.7 }]}>{r.cohort_size}</Text>
              {renderCell(r.day1_retained, 1)}
              {renderCell(r.day7_retained, 7)}
              {renderCell(r.day30_retained, 30)}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>즐겨찾기 TOP 5 머신</Text>
      <View style={styles.tableCard}>
        {topFavorites.length === 0 && <Text style={styles.emptyText}>아직 즐겨찾기 데이터가 없어요</Text>}
        {topFavorites.map((m, i) => (
          <View key={m.machineId} style={[styles.eventRow, i === topFavorites.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.eventName} numberOfLines={1}>{m.machineName} <Text style={styles.eventUnique}>({m.machineBrand})</Text></Text>
            <Text style={styles.eventCount}>{m.favoriteCount}명 즐겨찾기</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>활동 상위 헬스장 TOP 5 (최근 30일)</Text>
      <View style={styles.tableCard}>
        {topGyms.length === 0 && <Text style={styles.emptyText}>아직 활동 데이터가 없어요</Text>}
        {topGyms.map((g, i) => (
          <View key={g.gymId} style={[styles.eventRow, i === topGyms.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.eventName} numberOfLines={1}>{g.gymName}</Text>
            <View style={styles.eventStats}>
              <Text style={styles.eventCount}>{g.sessionCount}건</Text>
              <Text style={styles.eventUnique}>{g.uniqueUsers}명 이용</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>휴면 위험 유저 (마지막 운동일지 기준)</Text>
      <View style={styles.tableCard}>
        <View style={styles.eventRow}>
          <Text style={styles.eventName}>활동 중 (7일 이내)</Text>
          <Text style={[styles.eventCount, { color: '#3dd68c' }]}>{atRisk.active7d}명</Text>
        </View>
        <View style={styles.eventRow}>
          <Text style={styles.eventName}>위험군 (7~14일 미활동)</Text>
          <Text style={[styles.eventCount, { color: '#f5a623' }]}>{atRisk.atRisk7to14d}명</Text>
        </View>
        <View style={styles.eventRow}>
          <Text style={styles.eventName}>위험군 (14~30일 미활동)</Text>
          <Text style={[styles.eventCount, { color: '#f5a623' }]}>{atRisk.atRisk14to30d}명</Text>
        </View>
        <View style={[styles.eventRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.eventName}>이탈 추정 (30일+ 미활동)</Text>
          <Text style={[styles.eventCount, { color: C.danger }]}>{atRisk.dormant30dPlus}명</Text>
        </View>
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

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSub,
    gap: 8,
  },
  eventName: { ...T.body, fontSize: 13, fontWeight: '700', color: C.text, flex: 1 },
  eventStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  eventCount: { ...T.body, fontSize: 12, color: C.text, fontWeight: '700' },
  eventUnique: { ...T.body, fontSize: 11, color: C.textSub },

  // 운동일지 작성 퍼널
  funnelRow: {
    paddingVertical: 10,
    paddingHorizontal: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSub,
    gap: 6,
  },
  funnelHeaderLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  funnelStepLabel: { ...T.body, fontSize: 13, fontWeight: '700', color: C.text },
  funnelStepCount: { ...T.body, fontSize: 11, color: C.textSub },
  funnelTrack: { height: 8, borderRadius: 4, backgroundColor: C.surfaceHigh, overflow: 'hidden' },
  funnelFill: { height: 8, borderRadius: 4, backgroundColor: C.accent },

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
  tableCell: { flex: 1, ...T.body, fontSize: 11, color: C.textSub, textAlign: 'center' },
  tableCellSub: { fontSize: 9, color: C.textDim },
  tableCellPending: { color: C.textDim, fontStyle: 'italic' },
  tableHeaderText: { color: C.textSub, fontWeight: '700', fontSize: 12 },
});
