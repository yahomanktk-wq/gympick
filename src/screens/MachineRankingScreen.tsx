import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, R, T } from '../theme';
import { screenPad } from '../theme/responsive';
import { fetchAllRankings, fetchRankingByMuscle } from '../lib/db';
import { MachineRankingEntry, Machine } from '../data/types';
import MachineRankingCard from '../components/MachineRankingCard';
import MachineDetailModal from './flow/MachineDetailModal';
import { MACHINES } from '../data/machines';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_TABS = ['ALL', 'CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'GLUTES'] as const;
type TabValue = typeof ALL_TABS[number];

const MUSCLE_ORDER = ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'GLUTES'];

const RANK_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const CHANGE_META: Record<MachineRankingEntry['usageChange'], { symbol: string; color: string }> = {
  up:   { symbol: '▲', color: C.accent  },
  down: { symbol: '▼', color: '#FF5252' },
  same: { symbol: '—', color: C.textDim },
};

// ── Sub-components (module-level) ─────────────────────────────────────────────

function NavHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.navHeader}>
      <TouchableOpacity style={s.navBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </TouchableOpacity>
      <View style={s.navTitleWrap}>
        <Text style={s.navTitle}>머신 랭킹</Text>
        <Text style={s.navSub}>이번 주 가장 많이 사용된 머신</Text>
      </View>
      <View style={s.navBtn} />
    </View>
  );
}

function UpdatedLabel({ updatedAt }: { updatedAt: string }) {
  const label = (() => {
    const d = new Date(updatedAt);
    const m  = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${dd} ${hh}:${mm}`;
  })();
  return (
    <Text style={s.updatedLabel}>
      최근 갱신: {label} · 1시간마다 업데이트
    </Text>
  );
}

function TabBar({
  active,
  onSelect,
}: {
  active:   TabValue;
  onSelect: (t: TabValue) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.tabBar}
      contentContainerStyle={s.tabBarContent}
    >
      {ALL_TABS.map(tab => {
        const on = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            style={[s.tab, on && s.tabActive]}
            onPress={() => onSelect(tab)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, on && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function SectionDivider() {
  return <View style={s.sectionDivider} />;
}

function AllTabView({
  rankings,
  onSelectMachine,
}: {
  rankings:        MachineRankingEntry[];
  onSelectMachine: (machineId: string) => void;
}) {
  return (
    <>
      {MUSCLE_ORDER.map((muscle, idx) => {
        const entries = rankings.filter(e => e.muscle === muscle);
        if (!entries.length) return null;
        return (
          <View key={muscle}>
            {idx > 0 && <SectionDivider />}
            <Text style={s.muscleSectionHead}>{muscle}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.allCardRow}
            >
              {entries.map(entry => (
                <MachineRankingCard
                  key={entry.machineId}
                  entry={entry}
                  onPress={() => onSelectMachine(entry.machineId)}
                />
              ))}
            </ScrollView>
          </View>
        );
      })}
    </>
  );
}

function FullWidthRow({
  entry,
  onPress,
}: {
  entry:   MachineRankingEntry;
  onPress: () => void;
}) {
  const change = CHANGE_META[entry.usageChange];
  return (
    <TouchableOpacity style={s.fullRow} activeOpacity={0.8} onPress={onPress}>
      <Text style={s.fullRowRank}>
        {RANK_EMOJI[entry.rank] ?? `#${entry.rank}`}
      </Text>
      <View style={s.fullRowMid}>
        <Text style={s.fullRowName} numberOfLines={1}>{entry.machineName}</Text>
        <Text style={s.fullRowBrand} numberOfLines={1}>{entry.brandName}</Text>
      </View>
      <View style={s.fullRowRight}>
        <Text style={s.fullRowCount}>{entry.usageCount.toLocaleString()}회</Text>
        <Text style={[s.fullRowChange, { color: change.color }]}>
          {change.symbol}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function MuscleTabView({
  muscle,
  rankings,
  onSelectMachine,
}: {
  muscle:          string;
  rankings:        MachineRankingEntry[];
  onSelectMachine: (machineId: string) => void;
}) {
  const entries = rankings
    .filter(e => e.muscle.toUpperCase() === muscle.toUpperCase())
    .sort((a, b) => a.rank - b.rank);
  if (!entries.length) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyText}>데이터가 없습니다.</Text>
      </View>
    );
  }
  return (
    <>
      {entries.map((entry, i) => (
        <React.Fragment key={entry.machineId}>
          {i > 0 && <View style={s.rowDivider} />}
          <FullWidthRow
            entry={entry}
            onPress={() => onSelectMachine(entry.machineId)}
          />
        </React.Fragment>
      ))}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MachineRankingScreen() {
  const nav = useNavigation<any>();
  const [activeTab,     setActiveTab]     = useState<TabValue>('ALL');
  const [detailMachine, setDetailMachine] = useState<Machine | null>(null);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [rankings,  setRankings]  = useState<MachineRankingEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [updatedAt, setUpdatedAt] = useState(() => new Date().toISOString());

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchAllRankings();
        if (active) {
          setRankings(data);
          setUpdatedAt(new Date().toISOString());
        }
      } catch {
        if (active) setRankings([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []));

  function handleSelectMachine(machineId: string) {
    // 실제 MACHINES에서 먼저 찾기
    const found = (MACHINES as Machine[]).find(m => m.id === machineId);
    if (found) {
      setDetailMachine(found);
      setModalVisible(true);
      return;
    }
    // Mock ID (m01~m18)인 경우 랭킹 데이터에서 임시 Machine 생성
    const rankingEntry = rankings.find(e => e.machineId === machineId);
    if (rankingEntry) {
      setDetailMachine({
        id:           rankingEntry.machineId,
        name:         rankingEntry.machineName,
        displayName:  rankingEntry.machineName,
        brand:        rankingEntry.brandName,
        targetMuscle: rankingEntry.muscle,
        category:     '',
        exerciseKind: 'machine',
      } as Machine);
      setModalVisible(true);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <NavHeader onBack={() => nav.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <UpdatedLabel updatedAt={updatedAt} />

        {/* Tab bar */}
        <TabBar active={activeTab} onSelect={setActiveTab} />

        {/* Content */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 48 }}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : (
          <View style={s.content}>
            {activeTab === 'ALL' ? (
              <AllTabView
                rankings={rankings}
                onSelectMachine={handleSelectMachine}
              />
            ) : (
              <MuscleTabView
                muscle={activeTab}
                rankings={rankings}
                onSelectMachine={handleSelectMachine}
              />
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <MachineDetailModal
        visible={modalVisible}
        machine={detailMachine}
        onClose={() => { setModalVisible(false); setDetailMachine(null); }}
      />
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
    paddingBottom: 24,
  },

  navHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navBtn: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  navTitleWrap: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  navTitle: {
    ...T.section,
    color: C.text,
  },
  navSub: {
    fontSize: 11,
    color:    C.textSub,
  },

  updatedLabel: {
    fontSize:          10,
    color:             C.textDim,
    textAlign:         'center',
    paddingVertical:   10,
    paddingHorizontal: screenPad,
  },

  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabBarContent: {
    paddingHorizontal: screenPad,
    gap:               4,
    paddingBottom:     0,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: C.accent,
  },
  tabText: {
    fontSize:   13,
    fontWeight: '700',
    color:      C.textSub,
  },
  tabTextActive: {
    color: C.accent,
  },

  content: {
    paddingHorizontal: screenPad,
    paddingTop:        16,
  },

  muscleSectionHead: {
    ...T.section,
    color:        C.text,
    marginBottom: 12,
  },
  allCardRow: {
    gap:           10,
    paddingBottom: 4,
    marginBottom:  8,
  },
  sectionDivider: {
    height:          1,
    backgroundColor: C.border,
    marginVertical:  20,
  },

  fullRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.surface,
    borderRadius:    R.card,
    padding:         16,
    height:          80,
    gap:             12,
  },
  fullRowRank: {
    fontSize:  22,
    width:     32,
    textAlign: 'center',
  },
  fullRowMid: {
    flex: 1,
    gap:  4,
  },
  fullRowName: {
    fontSize:   15,
    fontWeight: '800',
    color:      C.text,
  },
  fullRowBrand: {
    fontSize: 12,
    color:    C.textSub,
  },
  fullRowRight: {
    alignItems: 'flex-end',
    gap:        4,
  },
  fullRowCount: {
    fontSize:   14,
    fontWeight: '700',
    color:      C.text,
  },
  fullRowChange: {
    fontSize:   12,
    fontWeight: '800',
  },
  rowDivider: {
    height:          8,
    backgroundColor: 'transparent',
  },

  emptyWrap: {
    alignItems:      'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color:    C.textDim,
  },
});
