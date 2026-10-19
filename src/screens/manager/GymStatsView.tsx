import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Image, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import {
  fetchMachineUsageStats,
  fetchDailyUsageStats,
  fetchTopMachinesByMuscle,
  fetchPeakTimeStats,
  fetchMachineActivationRate,
  fetchOwnedMachineIds,
  fetchRetentionStats,
  fetchMachineAvgStats,
  MachineStat,
  DailyUsage,
  PeakTimeStats,
  MachineAvgStats,
  PeriodType,
} from '../../lib/db/gymStats';
import { getMachineImageUrl } from '../../lib/machineImageUrl';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W  = SCREEN_W - 32;
const CHART_H  = 160;

const MACHINE_IMG_URL = (id: string) => getMachineImageUrl(id, { width: 96 });

function getPeriodDates(period: PeriodType): { start: string; end: string } {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);

  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { start: start.toISOString().slice(0, 10), end: today };
  }
  if (period === 'month') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    return { start: start.toISOString().slice(0, 10), end: today };
  }
  return { start: today, end: today };
}

function BarChart({ data }: { data: DailyUsage[] }) {
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

const bc = StyleSheet.create({
  wrap:   { marginBottom: 8 },
  chart:  { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H - 20, paddingHorizontal: 8, gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:    { borderRadius: 2 },
  xAxis:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 4 },
  xLabel: { fontSize: 10, color: C.textDim },
});

interface GymStatsViewProps {
  gymId:         string;
  gymName:       string;
}

type TabType = 'usage' | 'trend' | 'top' | 'peak' | 'activation' | 'avg';

export default function GymStatsView({ gymId }: GymStatsViewProps) {
  const [activeTab,       setActiveTab]       = useState<TabType>('usage');
  const [period,          setPeriod]          = useState<PeriodType>('month');
  const [showCustom,      setShowCustom]      = useState(false);
  const [customStart,     setCustomStart]     = useState('');
  const [customEnd,       setCustomEnd]       = useState('');
  const [loading,         setLoading]         = useState(true);
  const [machineStats,    setMachineStats]    = useState<MachineStat[]>([]);
  const [dailyStats,      setDailyStats]      = useState<DailyUsage[]>([]);
  const [topByMuscle,     setTopByMuscle]     = useState<Record<string, MachineStat[]>>({});
  const [peakStats,       setPeakStats]       = useState<PeakTimeStats>({ byHour: {}, byDayOfWeek: {} });
  const [activationStats, setActivationStats] = useState({ activatedCount: 0, totalCount: 0, rate: 0 });
  const [retentionStats,  setRetentionStats]  = useState({ thisMonth: 0, lastMonth: 0, retentionRate: 0 });
  const [avgStats,        setAvgStats]        = useState<MachineAvgStats[]>([]);
  const [ownedLoadFailed, setOwnedLoadFailed] = useState(false);

  const loadStats = useCallback(async (overrideStart?: string, overrideEnd?: string) => {
    setLoading(true);
    const { start, end } = getPeriodDates(period);
    const s1 = overrideStart ?? start;
    const e1 = overrideEnd   ?? end;
    const [machine, daily, top, peak, activation, avg] = await Promise.all([
      fetchMachineUsageStats(gymId, s1, e1),
      fetchDailyUsageStats(gymId, s1, e1),
      fetchTopMachinesByMuscle(gymId, s1, e1),
      fetchPeakTimeStats(gymId, s1, e1),
      fetchOwnedMachineIds(gymId).then(async owned => {
        setOwnedLoadFailed(owned === null);
        return fetchMachineActivationRate(gymId, owned ?? [], s1, e1);
      }),
      fetchMachineAvgStats(gymId, s1, e1),
    ]);
    setMachineStats(machine);
    setDailyStats(daily);
    setTopByMuscle(top);
    setPeakStats(peak);
    setActivationStats(activation);
    setAvgStats(avg);

    const retention = await fetchRetentionStats(gymId);
    setRetentionStats(retention);
    setLoading(false);
  }, [gymId, period]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const totalUsage = machineStats.reduce((sum, m) => sum + m.usageCount, 0);
  const maxUsage   = machineStats.length > 0 ? machineStats[0].usageCount : 1;

  const MUSCLE_ORDER = ['Chest', 'Back', 'Leg', 'Shoulder', 'Arms', 'Glutes', 'Other'];
  const muscleKeys = Object.keys(topByMuscle).sort((a, b) => {
    const ai = MUSCLE_ORDER.indexOf(a);
    const bi = MUSCLE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const TABS: { key: TabType; label: string }[] = [
    { key: 'usage',      label: '머신별 이용' },
    { key: 'trend',      label: '추이' },
    { key: 'top',        label: '부위별 TOP' },
    { key: 'peak',       label: '피크타임' },
    { key: 'activation', label: '가동률' },
    { key: 'avg',        label: '평균 분석' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* 기간 필터 */}
      <View style={s.periodRow}>
        {([
          { key: 'week',  label: '7일'  },
          { key: 'month', label: '30일' },
        ] as { key: PeriodType; label: string }[]).map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.periodChip, period === p.key && !showCustom && s.periodChipActive]}
            onPress={() => { setPeriod(p.key); setShowCustom(false); }}
            activeOpacity={0.8}
          >
            <Text style={[s.periodChipText, period === p.key && !showCustom && s.periodChipTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.periodChip, showCustom && s.periodChipActive]}
          onPress={() => setShowCustom(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={12} color={showCustom ? C.bg : C.textSub} />
          <Text style={[s.periodChipText, showCustom && s.periodChipTextActive]}>기간 설정</Text>
        </TouchableOpacity>
      </View>

      {/* 기간 직접 입력 */}
      {showCustom && (
        <View style={s.customRow}>
          <TextInput
            style={s.customInput}
            value={customStart}
            onChangeText={setCustomStart}
            placeholder="시작 (YYYY-MM-DD)"
            placeholderTextColor={C.textDim}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <Text style={{ color: C.textDim, fontSize: 13 }}>~</Text>
          <TextInput
            style={s.customInput}
            value={customEnd}
            onChangeText={setCustomEnd}
            placeholder="종료 (YYYY-MM-DD)"
            placeholderTextColor={C.textDim}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <TouchableOpacity
            style={s.customApplyBtn}
            onPress={() => {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(customStart) || !/^\d{4}-\d{2}-\d{2}$/.test(customEnd)) {
                Alert.alert('날짜 형식 오류', 'YYYY-MM-DD 형식으로 입력해주세요.');
                return;
              }
              if (customStart > customEnd) {
                Alert.alert('날짜 오류', '시작일이 종료일보다 늦을 수 없습니다.');
                return;
              }
              setPeriod('custom');
              loadStats(customStart, customEnd);
            }}
            activeOpacity={0.8}
          >
            <Text style={s.customApplyText}>조회</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 탭 — 수평 스크롤 */}
      <View style={{ backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 16 }}
        >
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, activeTab === t.key && s.tabActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={s.loadingText}>통계 불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── 머신별 이용횟수 ── */}
          {activeTab === 'usage' && (
            <View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>총 이용 횟수</Text>
                <Text style={s.summaryValue}>{totalUsage}회</Text>
              </View>
              {machineStats.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Ionicons name="bar-chart-outline" size={36} color={C.textDim} />
                  <Text style={s.emptyText}>해당 기간에 운동 기록이 없어요</Text>
                </View>
              ) : (
                <View style={s.card}>
                  {machineStats.map((m, i) => (
                    <View key={m.machineId} style={[s.machineRow, i > 0 && s.divider]}>
                      <View style={s.machineRankBadge}>
                        <Text style={s.machineRank}>{i + 1}</Text>
                      </View>
                      <Image
                        source={{ uri: MACHINE_IMG_URL(m.machineId) }}
                        style={s.machineImg}
                        resizeMode="contain"
                      />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={s.machineNameRow}>
                          <Text style={s.machineName} numberOfLines={1}>{m.machineName}</Text>
                          <Text style={s.machineCount}>{m.usageCount}회</Text>
                        </View>
                        <Text style={s.machineBrand}>{m.machineBrand} · {m.targetMuscle}</Text>
                        <View style={s.usageBarBg}>
                          <View style={[s.usageBarFill, { width: `${(m.usageCount / maxUsage) * 100}%` }]} />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── 추이 차트 ── */}
          {activeTab === 'trend' && (
            <View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>총 운동 세션</Text>
                <Text style={s.summaryValue}>{dailyStats.reduce((sum, d) => sum + d.count, 0)}회</Text>
              </View>
              <View style={s.card}>
                <Text style={s.chartTitle}>일별 운동 횟수</Text>
                <BarChart data={dailyStats} />
              </View>
            </View>
          )}

          {/* ── 부위별 TOP 10 ── */}
          {activeTab === 'top' && (
            <View style={{ gap: 16 }}>
              {muscleKeys.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Ionicons name="trophy-outline" size={36} color={C.textDim} />
                  <Text style={s.emptyText}>해당 기간에 운동 기록이 없어요</Text>
                </View>
              ) : (
                muscleKeys.map(muscle => (
                  <View key={muscle}>
                    <Text style={s.muscleHeader}>{muscle.toUpperCase()}</Text>
                    <View style={s.card}>
                      {topByMuscle[muscle].map((m, i) => (
                        <View key={m.machineId} style={[s.machineRow, i > 0 && s.divider]}>
                          <View style={[s.machineRankBadge, i === 0 && s.machineRankBadgeTop]}>
                            <Text style={[s.machineRank, i === 0 && s.machineRankTop]}>{i + 1}</Text>
                          </View>
                          <Image
                            source={{ uri: MACHINE_IMG_URL(m.machineId) }}
                            style={s.machineImg}
                            resizeMode="contain"
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={s.machineName} numberOfLines={1}>{m.machineName}</Text>
                            <Text style={s.machineBrand}>{m.machineBrand}</Text>
                          </View>
                          <Text style={s.machineCount}>{m.usageCount}회</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ── 피크타임 ── */}
          {activeTab === 'peak' && (
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
          )}

          {/* ── 가동률 + 재방문율 ── */}
          {activeTab === 'activation' && (
            <View style={{ gap: 16 }}>
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
                    <Text style={s.kpiValue}>{retentionStats.retentionRate}%</Text>
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
                  저번 달 회원 중 {retentionStats.retentionRate}%가 이번 달에도 방문했습니다
                </Text>
              </View>
            </View>
          )}

          {/* ── 평균 분석 ── */}
          {activeTab === 'avg' && (
            <View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>머신별 평균 세트/중량</Text>
              </View>
              {avgStats.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Ionicons name="analytics-outline" size={36} color={C.textDim} />
                  <Text style={s.emptyText}>해당 기간에 데이터가 없어요</Text>
                </View>
              ) : (
                <View style={s.card}>
                  {avgStats.map((m, i) => (
                    <View key={m.machineId} style={[s.machineRow, i > 0 && s.divider]}>
                      <Image
                        source={{ uri: MACHINE_IMG_URL(m.machineId) }}
                        style={s.machineImg}
                        resizeMode="contain"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.machineName} numberOfLines={1}>{m.machineName}</Text>
                        <Text style={s.machineBrand}>{m.machineBrand} · {m.targetMuscle}</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                          <Text style={s.avgChip}>평균 {m.avgSets}세트</Text>
                          {m.avgWeight > 0 && (
                            <Text style={s.avgChip}>{m.avgWeight} kg</Text>
                          )}
                          <Text style={[s.avgChip, { color: C.textDim }]}>{m.usageCount}회 이용</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  periodRow: {
    flexDirection:     'row',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    backgroundColor:   C.bg,
    alignItems:        'center',
  },
  periodChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
  },
  periodChipActive:     { backgroundColor: C.accent, borderColor: C.accent },
  periodChipText:       { fontSize: 12, fontWeight: '600', color: C.textSub },
  periodChipTextActive: { color: C.bg },

  tab: {
    height:            42,
    paddingHorizontal: 12,
    alignItems:        'center',
    justifyContent:    'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
  },
  tabText:       { fontSize: 12, fontWeight: '600', color: C.textDim },
  tabTextActive: { color: C.accent, fontWeight: '800' },

  customRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingBottom:     8,
    backgroundColor:   C.bg,
  },
  customInput: {
    flex:              1,
    height:            34,
    backgroundColor:   C.surface,
    borderRadius:      R.inner,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: 10,
    fontSize:          12,
    color:             C.text,
  },
  customApplyBtn: {
    paddingHorizontal: 12,
    paddingVertical:   7,
    backgroundColor:   C.accent,
    borderRadius:      R.pill,
  },
  customApplyText: { fontSize: 12, fontWeight: '700', color: C.bg },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  loadingText: { fontSize: 13, color: C.textDim },

  scroll: { padding: 16, gap: 16 },

  summaryRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  summaryLabel: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  summaryValue: { fontSize: 20, fontWeight: '900', color: C.accent },

  card: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    overflow:        'hidden',
  },
  divider: { borderTopWidth: 1, borderTopColor: C.border },

  machineRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    padding:       14,
  },
  machineRankBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: C.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },
  machineRankBadgeTop: { backgroundColor: C.accent },
  machineRank:         { fontSize: 12, fontWeight: '800', color: C.textSub },
  machineRankTop:      { color: C.bg },
  machineImg:          { width: 48, height: 48, borderRadius: 8, backgroundColor: '#FFFFFF' },
  machineNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  machineName:    { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  machineBrand:   { fontSize: 11, color: C.textDim },
  machineCount:   { fontSize: 14, fontWeight: '800', color: C.accent, marginLeft: 8 },

  usageBarBg:   { height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 2 },
  usageBarFill: { height: 4, backgroundColor: C.accent, borderRadius: 2 },

  chartTitle: { fontSize: 13, fontWeight: '700', color: C.text, padding: 14, paddingBottom: 8 },

  muscleHeader: { fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 1, marginBottom: 6 },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 13, color: C.textDim },

  peakRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  peakLabel:   { width: 32, fontSize: 12, fontWeight: '600', color: C.textSub },
  peakBarWrap: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3 },
  peakBar:     { height: 6, backgroundColor: C.accent, borderRadius: 3 },
  peakCount:   { width: 30, fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'right' },

  kpiRow:   { flexDirection: 'row', padding: 16, gap: 8 },
  kpiCell:  { flex: 1, alignItems: 'center', gap: 4 },
  kpiValue: { fontSize: 22, fontWeight: '900', color: C.accent },
  kpiLabel: { fontSize: 10, color: C.textDim, fontWeight: '600', textAlign: 'center' },

  avgChip: { fontSize: 11, fontWeight: '700', color: C.accent },
});
