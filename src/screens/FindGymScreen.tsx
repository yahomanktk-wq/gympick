import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';
import { MACHINES, GYMS_WITH_MACHINES, Machine, GymWithMachines } from '../data';
import GymFlowModal       from './flow/GymFlowModal';
import MachineDetailModal from './flow/MachineDetailModal';

// ─── Filter options ───────────────────────────────────────────────────────────

const MUSCLES = [
  'All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body', 'Glutes',
];

const BRANDS = [
  'All',
  ...[...new Set(MACHINES.map(m => m.brand))].sort(),
];

// ─── Mock distances ───────────────────────────────────────────────────────────

const MOCK_DIST: Record<string, { dist: string; distNum: number; open: boolean }> = {
  g01: { dist: '0.3 km', distNum: 0.3, open: true  },
  g02: { dist: '0.9 km', distNum: 0.9, open: true  },
  g03: { dist: '1.1 km', distNum: 1.1, open: true  },
  g04: { dist: '1.4 km', distNum: 1.4, open: false },
  g05: { dist: '2.0 km', distNum: 2.0, open: true  },
  g06: { dist: '2.3 km', distNum: 2.3, open: false },
  g07: { dist: '3.1 km', distNum: 3.1, open: true  },
  g08: { dist: '4.5 km', distNum: 4.5, open: true  },
};

function getDist(id: string) {
  return MOCK_DIST[id] ?? { dist: '? km', distNum: 99, open: true };
}

// ─── Muscle colour palette ────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:       C.tagMachine,
  Back:        C.tagBrand,
  Legs:        C.tagMuscle,
  Shoulders:   { fg: '#ffd166', bg: '#ffd16618' },
  Arms:        C.tagCategory,
  Core:        { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
  Glutes:      { fg: '#ff9ecd', bg: '#ff9ecd18' },
};

function mpStyle(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

// ─── Filter chip row ──────────────────────────────────────────────────────────

function FilterRow({
  sectionLabel,
  options,
  active,
  onSelect,
  activeColor,
}: {
  sectionLabel: string;
  options:      string[];
  active:       string;
  onSelect:     (v: string) => void;
  activeColor:  string;
}) {
  return (
    <View>
      <Text style={s.filterLabel}>{sectionLabel}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
      >
        {options.map(opt => {
          const on = opt === active;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                s.filterChip,
                on && { backgroundColor: activeColor, borderColor: activeColor },
              ]}
              onPress={() => onSelect(on ? 'All' : opt)}
              activeOpacity={0.75}
            >
              <Text style={[s.filterChipText, on && { color: C.bg }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.countPill}>
        <Text style={s.countPillText}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Machine card ─────────────────────────────────────────────────────────────

function MachineCard({
  machine,
  gymCount,
  onPress,
}: {
  machine:  Machine;
  gymCount: number;
  onPress:  () => void;
}) {
  const mp = mpStyle(machine.targetMuscle);
  return (
    <TouchableOpacity style={s.machineCard} activeOpacity={0.8} onPress={onPress}>
      <View style={[s.machineCardIcon, { backgroundColor: mp.bg }]}>
        <Ionicons name="barbell-outline" size={18} color={mp.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.machineCardName}>{machine.name}</Text>
        <Text style={s.machineCardSub}>{machine.brand} · {gymCount} gym{gymCount !== 1 ? 's' : ''}</Text>
      </View>
      <View style={[s.musclePill, { backgroundColor: mp.bg }]}>
        <Text style={[s.musclePillText, { color: mp.fg }]}>{machine.targetMuscle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.textDim} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}

// ─── Gym card ─────────────────────────────────────────────────────────────────

function GymCard({
  gym,
  matchCount,
  onPress,
}: {
  gym:        GymWithMachines;
  matchCount: number;
  onPress:    () => void;
}) {
  const meta = getDist(gym.id);
  return (
    <TouchableOpacity style={s.gymCard} activeOpacity={0.8} onPress={onPress}>
      <View style={[s.gymCardBar, { backgroundColor: meta.open ? C.accent : C.textDim }]} />
      <View style={{ flex: 1, paddingLeft: 14 }}>
        <View style={s.gymCardTop}>
          <Text style={s.gymCardName}>{gym.name}</Text>
          <View style={[s.openBadge, { backgroundColor: meta.open ? C.accentBg : C.border }]}>
            <Text style={[s.openBadgeText, { color: meta.open ? C.accent : C.textSub }]}>
              {meta.open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
        <View style={s.gymCardMeta}>
          <Ionicons name="location-outline" size={11} color={C.textSub} />
          <Text style={s.gymCardLoc}>{gym.location}</Text>
        </View>
        <View style={s.gymCardFooter}>
          <View style={s.distBadge}>
            <Ionicons name="navigate-outline" size={10} color={C.accent} />
            <Text style={s.distText}>{meta.dist}</Text>
          </View>
          <Text style={s.gymMatchText}>
            {matchCount} matching machine{matchCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.textDim} style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyRow({ label }: { label: string }) {
  return (
    <View style={s.emptyRow}>
      <Text style={s.emptyRowText}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FindGymScreen() {
  const [keyword,        setKeyword]        = useState('');
  const [activeMuscle,   setActiveMuscle]   = useState('All');
  const [activeBrand,    setActiveBrand]    = useState('All');
  const [detailMachine,  setDetailMachine]  = useState<Machine | null>(null);
  const [gymFlowId,      setGymFlowId]      = useState<string | undefined>(undefined);
  const [gymFlowVisible, setGymFlowVisible] = useState(false);

  const hasFilters =
    keyword.trim().length > 0 || activeMuscle !== 'All' || activeBrand !== 'All';

  function clearAll() {
    setKeyword('');
    setActiveMuscle('All');
    setActiveBrand('All');
  }

  // ── Filtered machines ────────────────────────────────────────────────────

  const filteredMachines = useMemo(() => {
    return MACHINES.filter(m => {
      const muscleOk = activeMuscle === 'All' || m.targetMuscle === activeMuscle;
      const brandOk  = activeBrand  === 'All' || m.brand         === activeBrand;
      const kw       = keyword.trim().toLowerCase();
      const keyOk    = !kw ||
        m.name.toLowerCase().includes(kw) ||
        m.category.toLowerCase().includes(kw);
      return muscleOk && brandOk && keyOk;
    });
  }, [keyword, activeMuscle, activeBrand]);

  // ── Filtered gyms (contain at least one matching machine) ───────────────

  const filteredGyms = useMemo(() => {
    const mIds = new Set(filteredMachines.map(m => m.id));
    return GYMS_WITH_MACHINES
      .filter(gym => gym.machines.some(m => mIds.has(m.id)))
      .sort((a, b) => getDist(a.id).distNum - getDist(b.id).distNum);
  }, [filteredMachines]);

  function gymMatchCount(gym: GymWithMachines) {
    const mIds = new Set(filteredMachines.map(m => m.id));
    return gym.machines.filter(m => mIds.has(m.id)).length;
  }

  function gymCountForMachine(machine: Machine) {
    return GYMS_WITH_MACHINES.filter(g =>
      g.machines.some(m => m.id === machine.id)
    ).length;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Fixed header + filters ── */}
      <View>
        {/* Title row */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Find Gym</Text>
            <Text style={s.headerSub}>Discover by machine, muscle, or brand</Text>
          </View>
          {hasFilters && (
            <TouchableOpacity style={s.clearBtn} onPress={clearAll} activeOpacity={0.75}>
              <Text style={s.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Keyword / machine type search */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.textSub} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="press, row, curl, fly, extension…"
            placeholderTextColor={C.textDim}
            value={keyword}
            onChangeText={setKeyword}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={C.accent}
          />
          {keyword.length > 0 && (
            <TouchableOpacity
              onPress={() => setKeyword('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={16} color={C.textDim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Muscle filter */}
        <FilterRow
          sectionLabel="TARGET MUSCLE"
          options={MUSCLES}
          active={activeMuscle}
          onSelect={setActiveMuscle}
          activeColor={C.tagMuscle.fg}
        />

        {/* Brand filter */}
        <FilterRow
          sectionLabel="BRAND"
          options={BRANDS}
          active={activeBrand}
          onSelect={setActiveBrand}
          activeColor={C.tagBrand.fg}
        />

        <View style={s.dividerLine} />
      </View>

      {/* ── Scrollable results ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.results}>

        {/* Machines */}
        <SectionHead title="Machines" count={filteredMachines.length} />
        {filteredMachines.length === 0 ? (
          <EmptyRow label="No machines match — try adjusting filters" />
        ) : (
          filteredMachines.map(machine => (
            <MachineCard
              key={machine.id}
              machine={machine}
              gymCount={gymCountForMachine(machine)}
              onPress={() => setDetailMachine(machine)}
            />
          ))
        )}

        {/* Gyms */}
        <SectionHead title="Gyms" count={filteredGyms.length} />
        {filteredGyms.length === 0 ? (
          <EmptyRow label="No gyms match — try adjusting filters" />
        ) : (
          filteredGyms.map(gym => (
            <GymCard
              key={gym.id}
              gym={gym}
              matchCount={gymMatchCount(gym)}
              onPress={() => {
                setGymFlowId(gym.id);
                setGymFlowVisible(true);
              }}
            />
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <MachineDetailModal
        visible={detailMachine !== null}
        machine={detailMachine}
        onClose={() => setDetailMachine(null)}
      />

      <GymFlowModal
        visible={gymFlowVisible}
        onClose={() => setGymFlowVisible(false)}
        initialGymId={gymFlowId}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    paddingHorizontal: 20,
    paddingTop:     18,
    paddingBottom:  12,
  },
  headerTitle: { ...T.title, color: C.text },
  headerSub:   { fontSize: 13, color: C.textSub, marginTop: 3 },
  clearBtn:    {
    marginTop: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  clearBtnText:{ fontSize: 12, fontWeight: '700', color: C.accent },

  // Search
  searchWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: C.surface,
    borderRadius:   R.inner,
    marginHorizontal: 16,
    marginBottom:   4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth:    1,
    borderColor:    C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  // Filters
  filterLabel: {
    fontSize: 9, fontWeight: '700', color: C.textDim,
    letterSpacing: 1.2, textTransform: 'uppercase',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 7,
  },
  filterRow:     { paddingHorizontal: 16, gap: 7, paddingBottom: 2 },
  filterChip:    {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: R.pill, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface,
  },
  filterChipText:{ fontSize: 13, fontWeight: '600', color: C.textSub },

  dividerLine: { height: 1, backgroundColor: C.border, marginTop: 8 },

  // Results
  results: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  sectionHead:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  sectionTitle:   { ...T.section, color: C.text },
  countPill:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  countPillText:  { fontSize: 12, fontWeight: '700', color: C.textSub },

  emptyRow:     { paddingVertical: 18, alignItems: 'center', marginBottom: 16 },
  emptyRowText: { fontSize: 13, color: C.textDim },

  // Machine card
  machineCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 8,
  },
  machineCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  machineCardName: { fontSize: 14, fontWeight: '700', color: C.text },
  machineCardSub:  { fontSize: 12, color: C.textSub, marginTop: 2 },
  musclePill:      { paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill },
  musclePillText:  { fontSize: 11, fontWeight: '700' },

  // Gym card
  gymCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 8, overflow: 'hidden',
    paddingRight: 14, paddingVertical: 13,
  },
  gymCardBar:    { width: 4, borderRadius: 2 },
  gymCardTop:    { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  gymCardName:   { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  gymCardMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  gymCardLoc:    { fontSize: 12, color: C.textSub },
  gymCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  openBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.pill },
  openBadgeText: { fontSize: 10, fontWeight: '700' },
  distBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accentBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  distText:      { fontSize: 11, fontWeight: '700', color: C.accent },
  gymMatchText:  { fontSize: 12, color: C.textSub },
});
