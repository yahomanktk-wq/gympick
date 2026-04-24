import React, { useState, useEffect } from 'react';
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
import { C, R, T } from '../theme';
import GymFlowModal from './flow/GymFlowModal';

// ─── Mock data ────────────────────────────────────────────────────────────────

const STATS = [
  { label: 'Workouts', value: '48', unit: 'total' },
  { label: 'This Week', value: '3', unit: 'sessions' },
  { label: 'Volume', value: '12.4', unit: 'tonnes' },
];

const NEARBY_GYMS = [
  { id: '1', gymDataId: 'g01', name: 'IronHub Fitness', dist: '0.3 km', machines: 18 },
  { id: '2', gymDataId: 'g04', name: 'MaxLift Arena',   dist: '0.9 km', machines: 24 },
  { id: '3', gymDataId: 'g05', name: 'FlexPoint Club',  dist: '1.4 km', machines: 15 },
];

const RECENT_EXERCISES = [
  { id: '1', name: 'Barbell Back Squat', sets: 4, top: '100 kg × 5', muscle: 'Legs' },
  { id: '2', name: 'Bench Press',        sets: 3, top: '80 kg × 8',  muscle: 'Chest' },
  { id: '3', name: 'Deadlift',           sets: 3, top: '120 kg × 3', muscle: 'Back' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function useTimer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function GymChip({
  name, dist, machines, onPress,
}: {
  name: string; dist: string; machines: number; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.gymChip} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.gymChipDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.gymChipName} numberOfLines={1}>{name}</Text>
        <Text style={styles.gymChipSub}>{dist} · {machines} machines</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.textDim} />
    </TouchableOpacity>
  );
}

function ExerciseRow({
  name, sets, top, muscle,
}: { name: string; sets: number; top: string; muscle: string }) {
  return (
    <TouchableOpacity style={styles.exRow} activeOpacity={0.75}>
      <View style={styles.exIcon}>
        <Ionicons name="barbell-outline" size={16} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.exName}>{name}</Text>
        <Text style={styles.exSub}>{sets} sets · {top}</Text>
      </View>
      <View style={styles.musclePill}>
        <Text style={styles.musclePillText}>{muscle}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const timer = useTimer();
  const [flowVisible, setFlowVisible] = useState(false);
  const [flowGymId, setFlowGymId] = useState<string | undefined>(undefined);

  function openNearby() {
    setFlowGymId(undefined);
    setFlowVisible(true);
  }

  function openGym(gymId: string) {
    setFlowGymId(gymId);
    setFlowVisible(true);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>{greeting()},</Text>
            <Text style={styles.name}>Alex</Text>
          </View>
          <TouchableOpacity style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </TouchableOpacity>
        </View>

        {/* ── Streak banner ── */}
        <View style={styles.streakBanner}>
          <Ionicons name="flame" size={18} color={C.bg} />
          <Text style={styles.streakText}>12-day streak — keep it up!</Text>
        </View>

        {/* ── Stats row ── */}
        <Text style={styles.sectionTitle}>Your Stats</Text>
        <View style={styles.statsRow}>
          {STATS.map(s => <StatCard key={s.label} {...s} />)}
        </View>

        {/* ── Start Workout CTA ── */}
        <View style={styles.ctaCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaEyebrow}>READY TO LIFT?</Text>
            <Text style={styles.ctaTitle}>Start a{'\n'}Workout</Text>
          </View>
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={openNearby}>
            <Ionicons name="play" size={22} color={C.bg} />
          </TouchableOpacity>
        </View>

        {/* ── Active session ticker (demo) ── */}
        <View style={styles.sessionTicker}>
          <View style={styles.sessionDot} />
          <Text style={styles.sessionTickerText}>Last session active: </Text>
          <Text style={styles.sessionTimer}>{timer}</Text>
        </View>

        {/* ── Nearby gyms ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Nearby Gyms</Text>
          <TouchableOpacity onPress={openNearby}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gymRow}
        >
          {NEARBY_GYMS.map(g => (
            <GymChip key={g.id} {...g} onPress={() => openGym(g.gymDataId)} />
          ))}
        </ScrollView>

        {/* ── Recent exercises ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Last Session</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>View log</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {RECENT_EXERCISES.map((e, i) => (
            <React.Fragment key={e.id}>
              <ExerciseRow {...e} />
              {i < RECENT_EXERCISES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

      </ScrollView>

      <GymFlowModal
        visible={flowVisible}
        onClose={() => setFlowVisible(false)}
        initialGymId={flowGymId}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  greet: { fontSize: 15, color: C.textSub, fontWeight: '500' },
  name:  { ...T.hero, color: C.text },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: C.bg },

  // Streak
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 24,
    backgroundColor: C.accent,
    borderRadius: R.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  streakText: { fontSize: 13, fontWeight: '700', color: C.bg },

  // Section headings
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  sectionTitle: { ...T.section, color: C.text, marginHorizontal: 20, marginBottom: 12 },
  seeAll:       { fontSize: 13, fontWeight: '600', color: C.accent },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: { ...T.title, color: C.text },
  statUnit:  { fontSize: 11, color: C.accent, fontWeight: '700', marginTop: 2 },
  statLabel: { fontSize: 11, color: C.textSub, marginTop: 4, fontWeight: '500' },

  // CTA
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: C.accent + '40',
    overflow: 'hidden',
  },
  ctaEyebrow: { ...T.micro, color: C.accent, marginBottom: 6 },
  ctaTitle:   { fontSize: 28, fontWeight: '900', color: C.text, lineHeight: 30, letterSpacing: -0.8 },
  ctaBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Session ticker
  sessionTicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 28,
    gap: 6,
  },
  sessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent },
  sessionTickerText: { fontSize: 12, color: C.textSub },
  sessionTimer:      { fontSize: 12, fontWeight: '700', color: C.accent, fontVariant: ['tabular-nums'] },

  // Gym chips
  gymRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 4, marginBottom: 24 },
  gymChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    width: 210,
  },
  gymChipDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  gymChipName: { fontSize: 14, fontWeight: '700', color: C.text },
  gymChipSub:  { fontSize: 12, color: C.textSub, marginTop: 2 },

  // Card wrapper
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 58 },

  // Exercise rows
  exRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  exIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exName: { fontSize: 14, fontWeight: '700', color: C.text },
  exSub:  { fontSize: 12, color: C.textSub, marginTop: 2 },
  musclePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: C.accentBg,
  },
  musclePillText: { fontSize: 11, fontWeight: '700', color: C.accent },
});
