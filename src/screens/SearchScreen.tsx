import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';
import {
  FilterType,
  GymWithMachines,
  buildFilterChips,
  filterGyms,
} from '../data';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_CHIPS = buildFilterChips();

const CHIP_META: Record<FilterType, { label: string; fg: string; bg: string }> = {
  machine:  { label: 'Machine',  ...C.tagMachine },
  brand:    { label: 'Brand',    ...C.tagBrand },
  muscle:   { label: 'Muscle',   ...C.tagMuscle },
  category: { label: 'Category', ...C.tagCategory },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Pill({ label, type }: { label: string; type: FilterType }) {
  const m = CHIP_META[type];
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }]}>
      <Text style={[styles.pillText, { color: m.fg }]}>{label}</Text>
    </View>
  );
}

function GymCard({ gym }: { gym: GymWithMachines }) {
  const seen = new Set<string>();
  const pills = [
    ...gym.machines.slice(0, 2).map(m => ({ label: m.name,         type: 'machine'  as FilterType })),
    ...gym.machines.slice(0, 1).map(m => ({ label: m.brand,        type: 'brand'    as FilterType })),
    ...gym.machines.slice(0, 1).map(m => ({ label: m.targetMuscle, type: 'muscle'   as FilterType })),
    ...gym.machines.slice(0, 1).map(m => ({ label: m.category,     type: 'category' as FilterType })),
  ].filter(p => { if (seen.has(p.label)) return false; seen.add(p.label); return true; });

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={styles.gymIcon}>
          <Ionicons name="barbell" size={18} color={C.accent} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.gymName}>{gym.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color={C.textSub} />
            <Text style={styles.locationText}>{gym.location}</Text>
          </View>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countNum}>{gym.machines.length}</Text>
          <Text style={styles.countLabel}>machines</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>{gym.description}</Text>

      <View style={styles.pillRow}>
        {pills.map((p, i) => <Pill key={i} label={p.label} type={p.type} />)}
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const [query, setQuery]             = useState('');
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [activeTypes, setActiveTypes] = useState<Set<FilterType>>(new Set());

  const toggleType = (type: FilterType) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
    setActiveChips(new Set());
  };

  const toggleChip = (label: string) => {
    setActiveChips(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const clearAll = () => { setQuery(''); setActiveChips(new Set()); setActiveTypes(new Set()); };

  const visibleChips = activeTypes.size === 0
    ? FILTER_CHIPS
    : FILTER_CHIPS.filter(c => activeTypes.has(c.type));

  const results = useMemo(() => filterGyms(query, activeChips), [query, activeChips]);
  const hasFilters = query.length > 0 || activeChips.size > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Find a Gym</Text>
          <Text style={styles.headerSub}>Search by equipment, brand, or muscle</Text>
        </View>
        {hasFilters && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={C.textSub} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Gym, machine, brand, muscle…"
          placeholderTextColor={C.textDim}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          selectionColor={C.accent}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={17} color={C.textDim} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Type toggles ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
        {(Object.keys(CHIP_META) as FilterType[]).map(type => {
          const m      = CHIP_META[type];
          const active = activeTypes.has(type);
          return (
            <TouchableOpacity
              key={type}
              style={[styles.typeBtn, { borderColor: m.fg }, active && { backgroundColor: m.fg }]}
              onPress={() => toggleType(type)}
              activeOpacity={0.8}
            >
              <Text style={[styles.typeBtnText, { color: active ? C.bg : m.fg }]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {visibleChips.map(chip => {
          const m      = CHIP_META[chip.type];
          const active = activeChips.has(chip.label);
          return (
            <TouchableOpacity
              key={`${chip.type}-${chip.label}`}
              style={[styles.chip, { borderColor: m.fg + '60' }, active && { backgroundColor: m.fg, borderColor: m.fg }]}
              onPress={() => toggleChip(chip.label)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, { color: active ? C.bg : m.fg }]}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Results ── */}
      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <GymCard gym={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? 'gym' : 'gyms'} found
            {activeChips.size > 0 && `  ·  ${activeChips.size} filter${activeChips.size > 1 ? 's' : ''}`}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search" size={48} color={C.textDim} />
            <Text style={styles.emptyText}>No gyms match.</Text>
            <Text style={styles.emptyHint}>Try different keywords or clear filters.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={clearAll}>
              <Text style={styles.emptyBtnText}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: { ...T.title, color: C.text },
  headerSub:   { fontSize: 13, color: C.textSub, marginTop: 3 },
  clearBtn:    { marginTop: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  clearBtnText:{ fontSize: 12, fontWeight: '700', color: C.accent },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.inner,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text, padding: 0 },

  typeRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: R.pill,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  typeBtnText: { fontSize: 13, fontWeight: '700' },

  chipRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  chipText: { fontSize: 12, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  resultCount: { fontSize: 12, color: C.textSub, marginBottom: 12, marginTop: 2 },

  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  gymIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta:     { flex: 1 },
  gymName:      { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 12, color: C.textSub },
  countBadge:   { alignItems: 'center', backgroundColor: C.surfaceHigh, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  countNum:     { fontSize: 18, fontWeight: '800', color: C.accent, lineHeight: 20 },
  countLabel:   { fontSize: 9, color: C.textSub, fontWeight: '600' },
  description:  { fontSize: 13, color: C.textSub, lineHeight: 19, marginBottom: 12 },
  pillRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:         { paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill },
  pillText:     { fontSize: 11, fontWeight: '700' },

  empty:       { alignItems: 'center', paddingTop: 72, gap: 8 },
  emptyText:   { fontSize: 17, fontWeight: '700', color: C.textSub, marginTop: 8 },
  emptyHint:   { fontSize: 13, color: C.textDim },
  emptyBtn:    { marginTop: 14, paddingHorizontal: 22, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.accent },
  emptyBtnText:{ fontSize: 13, fontWeight: '700', color: C.bg },
});
