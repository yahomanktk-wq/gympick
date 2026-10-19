import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';
import {
  fetchMachineUsageStats,
  fetchDailyUsageStats,
  fetchTopMachinesByMuscle,
  fetchPeakTimeStats,
  fetchMachineActivationRate,
  fetchOwnedMachineIds,
  fetchRetentionStats,
  fetchMachineAvgStats,
  fetchMemberCount,
  MachineStat,
  DailyUsage,
  PeakTimeStats,
  MachineAvgStats,
  PeriodType,
} from '../../lib/db/gymStats';
import { kstToday, kstAddDays } from '../../lib/kstDate';
import { s } from './stats/statsStyles';
import OverviewTab from './stats/OverviewTab';
import MachineTab from './stats/MachineTab';
import TimeTab from './stats/TimeTab';

// 2026-10-19 (F5-2): 6탭 → 3탭(개요 / 머신 / 시간) 재구성. 각 탭 본문은 ./stats/ 로 이동했고,
// 이 파일은 기간 선택 + 데이터 로딩 + 탭 전환만 담당하는 컨테이너.

function getPeriodDates(period: PeriodType): { start: string; end: string } {
  const today = kstToday();

  if (period === 'week') {
    return { start: kstAddDays(today, -6), end: today };
  }
  if (period === 'month') {
    return { start: kstAddDays(today, -29), end: today };
  }
  return { start: today, end: today };
}

interface GymStatsViewProps {
  gymId:         string;
  gymName:       string;
}

type TabType = 'overview' | 'machine' | 'time';

const TABS: { key: TabType; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'machine',  label: '머신' },
  { key: 'time',     label: '시간' },
];

export default function GymStatsView({ gymId }: GymStatsViewProps) {
  const [activeTab,       setActiveTab]       = useState<TabType>('overview');
  const [period,          setPeriod]          = useState<PeriodType>('month');
  const [showCustom,      setShowCustom]      = useState(false);
  const [customStart,     setCustomStart]     = useState('');
  const [customEnd,       setCustomEnd]       = useState('');
  // '조회'로 확정된 직접 입력 기간. period === 'custom'일 때만 사용 (7일/30일로 바꿔도 값은 유지)
  const [customRange,     setCustomRange]     = useState<{ start: string; end: string } | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [machineStats,    setMachineStats]    = useState<MachineStat[]>([]);
  const [dailyStats,      setDailyStats]      = useState<DailyUsage[]>([]);
  const [topByMuscle,     setTopByMuscle]     = useState<Record<string, MachineStat[]>>({});
  const [peakStats,       setPeakStats]       = useState<PeakTimeStats>({ byHour: {}, byDayOfWeek: {} });
  const [activationStats, setActivationStats] = useState({ activatedCount: 0, totalCount: 0, rate: 0 });
  const [retentionStats,  setRetentionStats]  = useState<{ thisMonth: number; lastMonth: number; retentionRate: number | null; failed: boolean }>(
    { thisMonth: 0, lastMonth: 0, retentionRate: null, failed: false },
  );
  const [avgStats,        setAvgStats]        = useState<MachineAvgStats[]>([]);
  const [ownedLoadFailed, setOwnedLoadFailed] = useState(false);
  const [memberCount,     setMemberCount]     = useState(0);

  // 기간은 period + customRange에서만 계산 — '조회' 시 직접 loadStats를 부르지 않으므로,
  // effect가 올바른 범위로 정확히 한 번만 로드한다 (예전엔 today..today 로드와 경쟁해 덮어써짐).
  const loadStats = useCallback(async () => {
    setLoading(true);
    const { start: s1, end: e1 } =
      period === 'custom' && customRange ? customRange : getPeriodDates(period);
    const [machine, daily, top, peak, activation, avg, members] = await Promise.all([
      fetchMachineUsageStats(gymId, s1, e1),
      fetchDailyUsageStats(gymId, s1, e1),
      fetchTopMachinesByMuscle(gymId, s1, e1),
      fetchPeakTimeStats(gymId, s1, e1),
      fetchOwnedMachineIds(gymId).then(async owned => {
        setOwnedLoadFailed(owned === null);
        return fetchMachineActivationRate(gymId, owned ?? [], s1, e1);
      }),
      fetchMachineAvgStats(gymId, s1, e1),
      fetchMemberCount(gymId, s1, e1),
    ]);
    setMachineStats(machine);
    setDailyStats(daily);
    setTopByMuscle(top);
    setPeakStats(peak);
    setActivationStats(activation);
    setAvgStats(avg);
    setMemberCount(members);

    const retention = await fetchRetentionStats(gymId);
    setRetentionStats(retention);
    setLoading(false);
  }, [gymId, period, customRange]);

  useEffect(() => { loadStats(); }, [loadStats]);

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
              setCustomRange({ start: customStart, end: customEnd });
              setPeriod('custom');
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

          {activeTab === 'overview' && (
            <OverviewTab
              dailyStats={dailyStats}
              memberCount={memberCount}
              activationStats={activationStats}
              ownedLoadFailed={ownedLoadFailed}
              retentionStats={retentionStats}
            />
          )}

          {activeTab === 'machine' && (
            <MachineTab
              machineStats={machineStats}
              topByMuscle={topByMuscle}
              avgStats={avgStats}
            />
          )}

          {activeTab === 'time' && (
            <TimeTab dailyStats={dailyStats} peakStats={peakStats} />
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}
