import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { getAllNewPRs, PREntry } from '../data/prStore';

const SCREEN_W = Dimensions.get('window').width;

// --- Mock PR history data (Big 3)
// Each entry: { date: ISO string, weight: number, reps: number }

const BIG3_HISTORY: Record<string, { date: string; weight: number; reps: number }[]> = {
  Squat: [
    { date: '2026-01-10', weight: 80,  reps: 5 },
    { date: '2026-01-24', weight: 85,  reps: 5 },
    { date: '2026-02-07', weight: 90,  reps: 3 },
    { date: '2026-02-21', weight: 95,  reps: 3 },
    { date: '2026-03-04', weight: 100, reps: 5 },
  ],
  'Bench Press': [
    { date: '2026-01-12', weight: 55, reps: 8 },
    { date: '2026-01-26', weight: 60, reps: 6 },
    { date: '2026-02-09', weight: 65, reps: 5 },
    { date: '2026-02-20', weight: 68, reps: 5 },
    { date: '2026-03-02', weight: 70, reps: 8 },
  ],
  Deadlift: [
    { date: '2026-01-15', weight: 80,  reps: 5 },
    { date: '2026-01-29', weight: 87,  reps: 5 },
    { date: '2026-02-12', weight: 90,  reps: 5 },
    { date: '2026-02-26', weight: 95,  reps: 3 },
    { date: '2026-03-05', weight: 100, reps: 5 },
  ],
};

const LIFT_COLORS: Record<string, string> = {
  Squat:        '#5ba4ff',
  'Bench Press': '#c8ff57',
  Deadlift:     '#ff7c47',
};

const LIFT_ORDER = ['Squat', 'Bench Press', 'Deadlift'] as const;

// --- Mini bar chart

function PRChart({ entries, color }: { entries: typeof BIG3_HISTORY['Squat']; color: string }) {
  const weights = entries.map(e => e.weight);
  const maxW    = Math.max(...weights);
  const minW    = Math.min(...weights);
  const range   = maxW - minW || 1;
  const chartH  = 80;
  const barW    = Math.floor((SCREEN_W - 64 - (entries.length - 1) * 6) / entries.length);

  return (
    <View style={ch.container}>
      {/* Bars + labels */}
      <View style={[ch.barArea, { height: chartH }]}>
        {entries.map((e, i) => {
          const barH = Math.max(8, ((e.weight - minW) / range) * (chartH - 20) + 20);
          const isLast = i === entries.length - 1;
          return (
            <View key={i} style={[ch.barCol, { width: barW }]}>
              <Text style={[ch.barLabel, isLast && { color }]}>{e.weight}</Text>
              <View
                style={[
                  ch.bar,
                  { height: barH, backgroundColor: isLast ? color : color + '44', width: barW - 4 },
                ]}
              />
            </View>
          );
        })}
      </View>
      {/* Date labels */}
      <View style={ch.dateRow}>
        {entries.map((e, i) => {
          const d = new Date(e.date);
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          return (
            <Text key={i} style={[ch.dateLabel, { width: barW }]} numberOfLines={1}>{label}</Text>
          );
        })}
      </View>
    </View>
  );
}

// --- Lift section

function LiftSection({ name, entries }: { name: string; entries: typeof BIG3_HISTORY['Squat'] }) {
  const color  = LIFT_COLORS[name] ?? C.accent;
  const latest = entries[entries.length - 1];
  const prev   = entries[entries.length - 2];
  const delta  = latest && prev ? latest.weight - prev.weight : 0;

  return (
    <View style={s.liftCard}>
      {/* Header */}
      <View style={s.liftHeader}>
        <View style={[s.liftDot, { backgroundColor: color }]} />
        <Text style={s.liftName}>{name}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[s.liftBest, { color }]}>{latest?.weight ?? '—'} kg</Text>
        {delta > 0 && (
          <View style={[s.deltaBadge, { backgroundColor: color + '22' }]}>
            <Ionicons name="trending-up" size={11} color={color} />
            <Text style={[s.deltaText, { color }]}>+{delta} kg</Text>
          </View>
        )}
      </View>

      {/* Chart */}
      {entries.length >= 2 ? (
        <PRChart entries={entries} color={color} />
      ) : (
        <View style={s.noDataRow}>
          <Text style={s.noDataText}>더 많은 운동을 기록하면 차트가 표시돼요.</Text>
        </View>
      )}

      {/* History rows */}
      <View style={s.historyList}>
        {[...entries].reverse().map((e, i) => {
          const d   = new Date(e.date);
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <View key={i} style={[s.historyRow, i > 0 && s.historyRowBorder]}>
              <Text style={s.historyDate}>{dateStr}</Text>
              <View style={{ flex: 1 }} />
              <Text style={s.historyWeight}>{e.weight} kg</Text>
              <Text style={s.historyReps}>× {e.reps}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// --- Screen

export default function PRHistoryScreen({ onClose }: { onClose: () => void }) {
  const [selectedLift, setSelectedLift] = useState<string | null>(null);
  const newPRs: PREntry[] = getAllNewPRs();

  const liftsToShow = selectedLift
    ? LIFT_ORDER.filter(l => l === selectedLift)
    : LIFT_ORDER;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.heading}>PR 기록</Text>
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.textSub} />
        </TouchableOpacity>
      </View>

      {/* Lift filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
      >
        <TouchableOpacity
          style={[s.chip, !selectedLift && s.chipActive]}
          onPress={() => setSelectedLift(null)}
          activeOpacity={0.75}
        >
          <Text style={[s.chipTxt, !selectedLift && s.chipTxtActive]}>전체</Text>
        </TouchableOpacity>
        {LIFT_ORDER.map(l => {
          const active = selectedLift === l;
          const color  = LIFT_COLORS[l];
          return (
            <TouchableOpacity
              key={l}
              style={[s.chip, active && { backgroundColor: color + '22', borderColor: color + '44' }]}
              onPress={() => setSelectedLift(l)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipTxt, active && { color }]}>{l}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Newly detected PRs from this session */}
        {newPRs.length > 0 && !selectedLift && (
          <View style={s.newPRsCard}>
            <Text style={s.newPRsTitle}>🎉 최근 PR</Text>
            {newPRs.map((pr, i) => (
              <View key={i} style={[s.newPRRow, i > 0 && s.newPRRowBorder]}>
                <Text style={s.newPRName}>{pr.exerciseName}</Text>
                <View style={{ flex: 1 }} />
                <Text style={s.newPRWeight}>{pr.weight} kg</Text>
                <Text style={s.newPRReps}>× {pr.reps}</Text>
              </View>
            ))}
          </View>
        )}

        {liftsToShow.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={C.textDim} />
            <Text style={s.emptyTitle}>아직 PR 기록이 없어요.</Text>
            <Text style={s.emptySub}>운동을 기록하면 PR 기록이 여기에 표시돼요.</Text>
          </View>
        ) : (
          liftsToShow.map(l => (
            <LiftSection key={l} name={l} entries={BIG3_HISTORY[l] ?? []} />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Chart styles

const ch = StyleSheet.create({
  container: { marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  barArea:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol:    { alignItems: 'center', justifyContent: 'flex-end' },
  barLabel:  { fontSize: 9, fontWeight: '700', color: C.textDim, marginBottom: 4 },
  bar:       { borderRadius: 4 },
  dateRow:   { flexDirection: 'row', gap: 6, marginTop: 6 },
  dateLabel: { fontSize: 9, color: C.textDim, textAlign: 'center' },
});

// --- Screen styles

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: 8, paddingBottom: 32 },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  heading:  { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.8 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: 'transparent',
  },
  chipActive:    { backgroundColor: C.accent },
  chipTxt:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  chipTxtActive: { color: C.bg },

  liftCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: 'hidden',
    paddingTop: 16,
    paddingBottom: 8,
  },
  liftHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, marginBottom: 12,
  },
  liftDot:  { width: 10, height: 10, borderRadius: 5 },
  liftName: { fontSize: 16, fontWeight: '800', color: C.text },
  liftBest: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },

  deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill, marginLeft: 6 },
  deltaText:  { fontSize: 11, fontWeight: '700' },

  noDataRow:  { paddingHorizontal: 16, paddingVertical: 12 },
  noDataText: { fontSize: 13, color: C.textDim },

  historyList: { marginTop: 12 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 11,
  },
  historyRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  historyDate:   { fontSize: 13, color: C.textSub, fontWeight: '500' },
  historyWeight: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  historyReps:   { fontSize: 12, color: C.textDim, fontWeight: '600', marginLeft: 6, width: 32 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 16 },
  emptySub:   { fontSize: 13, color: C.textSub, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // New PRs from current session
  newPRsCard:    { backgroundColor: C.surface, borderRadius: R.card, marginHorizontal: 16, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.accent + '30' },
  newPRsTitle:   { fontSize: 12, fontWeight: '900', color: C.accent, letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 12 },
  newPRRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  newPRRowBorder:{ borderTopWidth: 1, borderTopColor: C.border },
  newPRName:     { fontSize: 13, fontWeight: '700', color: C.text },
  newPRWeight:   { fontSize: 16, fontWeight: '900', color: C.accent, letterSpacing: -0.3 },
  newPRReps:     { fontSize: 12, color: C.textDim, fontWeight: '600', marginLeft: 5, width: 36 },
});
