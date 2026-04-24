import React, { useState } from 'react';
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
import { MOCK_SESSIONS, WorkoutSession } from '../data/workoutSessions';
import PostWorkoutLogModal from './flow/PostWorkoutLogModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function sessionVolume(s: WorkoutSession): number {
  return s.machines.reduce((acc, m) => acc + m.weight * m.reps * m.sets, 0);
}

/** Top weight for a given muscle across sessions, chronological order (oldest → newest) */
function muscleTopWeights(sessions: WorkoutSession[], muscle: string): number[] {
  return sessions
    .filter(s => s.machines.some(m => m.targetMuscle === muscle))
    .slice()
    .reverse()
    .slice(0, 6)
    .map(s =>
      Math.max(...s.machines.filter(m => m.targetMuscle === muscle).map(m => m.weight)),
    );
}

/** Count sessions in each of the last 4 weeks (oldest → newest) */
function weeklyFrequency(sessions: WorkoutSession[]): number[] {
  const now = Date.now();
  return Array.from({ length: 4 }, (_, i) => {
    const end   = now - i * 7 * 86_400_000;
    const start = end  - 7 * 86_400_000;
    return sessions.filter(s => {
      const t = new Date(s.date).getTime();
      return t >= start && t < end;
    }).length;
  }).reverse();
}

// ─── MiniBarChart ─────────────────────────────────────────────────────────────

function MiniBarChart({
  values,
  color,
  height = 52,
}: {
  values: number[];
  color:  string;
  height?: number;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 3 }}>
      {values.map((v, i) => {
        const barH = Math.max(3, (v / max) * height);
        const isLast = i === values.length - 1;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            {v > 0 && (
              <Text style={{ fontSize: 7, color: isLast ? color : C.textDim, fontWeight: '700', marginBottom: 2 }}>
                {v}
              </Text>
            )}
            <View
              style={{
                width: '100%',
                height: barH,
                backgroundColor: color,
                borderRadius: 3,
                opacity: isLast ? 1 : 0.25 + (i / values.length) * 0.5,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

// ─── Progress chart card (full-width) ────────────────────────────────────────

function ProgressCard({
  label,
  values,
  unit,
  color,
}: {
  label:  string;
  values: number[];
  unit:   string;
  color:  string;
}) {
  const last  = values[values.length - 1];
  const prev  = values[values.length - 2];
  const delta = last !== undefined && prev !== undefined ? last - prev : null;

  return (
    <View style={st.progressCard}>
      <View style={st.progressCardTop}>
        <View>
          <Text style={st.progressLabel}>{label}</Text>
          {last !== undefined ? (
            <Text style={st.progressPeak}>
              {last} <Text style={st.progressUnit}>{unit}</Text>
            </Text>
          ) : (
            <Text style={st.progressEmpty}>No data</Text>
          )}
        </View>
        {delta !== null && (
          <View style={[st.deltaBadge, { backgroundColor: delta >= 0 ? C.accentBg : C.dangerBg }]}>
            <Ionicons
              name={delta >= 0 ? 'trending-up' : 'trending-down'}
              size={12}
              color={delta >= 0 ? C.accent : C.danger}
            />
            <Text style={[st.deltaText, { color: delta >= 0 ? C.accent : C.danger }]}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)} {unit}
            </Text>
          </View>
        )}
      </View>
      <MiniBarChart values={values} color={color} height={72} />
    </View>
  );
}

// ─── Frequency chart ──────────────────────────────────────────────────────────

function FrequencyChart({ values }: { values: number[] }) {
  const max    = Math.max(...values, 1);
  const labels = ['3w ago', '2w ago', 'Last wk', 'This wk'];
  return (
    <View style={st.freqCard}>
      <Text style={st.freqTitle}>Workout Frequency</Text>
      <Text style={st.freqSub}>Sessions per week</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 8, marginTop: 14 }}>
        {values.map((v, i) => {
          const barH   = Math.max(4, (v / max) * 72);
          const isLast = i === values.length - 1;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: isLast ? C.accent : C.textSub, marginBottom: 6 }}>
                {v}
              </Text>
              <View
                style={{
                  width: '100%', height: barH,
                  backgroundColor: isLast ? C.accent : C.surface,
                  borderWidth: 1, borderColor: isLast ? C.accent : C.border,
                  borderRadius: 8,
                }}
              />
              <Text style={{ fontSize: 9, color: C.textDim, marginTop: 6, textAlign: 'center' }}>
                {labels[i]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: WorkoutSession }) {
  const vol     = sessionVolume(session);
  const muscles = [...new Set(session.machines.map(m => m.targetMuscle))];

  return (
    <View style={st.sessionCard}>
      {/* Photo thumbnail */}
      <View style={st.thumb}>
        {session.hasPhoto ? (
          <View style={st.thumbPhoto}>
            <Ionicons name="barbell" size={20} color={C.accent} />
            <Text style={st.thumbPhotoLabel}>Photo</Text>
          </View>
        ) : (
          <View style={st.thumbEmpty}>
            <Ionicons name="image-outline" size={18} color={C.textDim} />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={st.sessionCardRow}>
          <Text style={st.sessionGym} numberOfLines={1}>{session.gymName}</Text>
          <Text style={st.sessionDate}>{formatDate(session.date)}</Text>
        </View>

        <View style={st.sessionMuscles}>
          {muscles.slice(0, 3).map(m => (
            <View key={m} style={st.muscleTag}>
              <Text style={st.muscleTagText}>{m}</Text>
            </View>
          ))}
          {muscles.length > 3 && (
            <Text style={st.muscleTagMore}>+{muscles.length - 3}</Text>
          )}
        </View>

        <View style={st.sessionFooterRow}>
          <Text style={st.sessionMeta}>{session.machines.length} machines</Text>
          {vol > 0 && (
            <Text style={st.sessionVol}>{vol.toFixed(0)} kg vol</Text>
          )}
          {session.bodyWeight && (
            <Text style={st.sessionBw}>BW {session.bodyWeight} kg</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const [sessions,    setSessions]    = useState<WorkoutSession[]>(MOCK_SESSIONS);
  const [logVisible,  setLogVisible]  = useState(false);

  const thisWeekCount = weeklyFrequency(sessions)[3];
  const totalVol      = sessions.reduce((a, s) => a + sessionVolume(s), 0);

  const chestProg = muscleTopWeights(sessions, 'Chest');
  const backProg  = muscleTopWeights(sessions, 'Back');
  const legsProg  = muscleTopWeights(sessions, 'Legs');
  const freqData  = weeklyFrequency(sessions);

  function handleLogClose(saved: boolean) {
    setLogVisible(false);
    // Production: if saved, refresh/append new session
  }

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={st.header}>
        <View>
          <Text style={st.heading}>Journal</Text>
          <Text style={st.headingSub}>{sessions.length} sessions · {thisWeekCount} this week</Text>
        </View>
        <TouchableOpacity style={st.logBtn} activeOpacity={0.85} onPress={() => setLogVisible(true)}>
          <Ionicons name="add" size={18} color={C.bg} />
          <Text style={st.logBtnText}>Log Workout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>

        {/* ── Quick stats ── */}
        <View style={st.statsRow}>
          <View style={st.statCard}>
            <Text style={st.statVal}>{sessions.length}</Text>
            <Text style={st.statLab}>Sessions</Text>
          </View>
          <View style={st.statCard}>
            <Text style={st.statVal}>{thisWeekCount}</Text>
            <Text style={st.statLab}>This week</Text>
          </View>
          <View style={st.statCard}>
            <Text style={st.statVal}>{(totalVol / 1000).toFixed(1)}</Text>
            <Text style={st.statLab}>Tonnes</Text>
          </View>
        </View>

        {/* ── Strength progress ── */}
        <Text style={st.sectionTitle}>Strength Progress</Text>
        <ProgressCard label="Chest" values={chestProg} unit="kg" color={C.tagMachine.fg} />
        <ProgressCard label="Back"  values={backProg}  unit="kg" color={C.tagBrand.fg}   />
        <ProgressCard label="Legs"  values={legsProg}  unit="kg" color={C.tagMuscle.fg}  />
        <View style={{ height: 10 }} />

        {/* ── Frequency ── */}
        <FrequencyChart values={freqData} />

        {/* ── Sessions ── */}
        <Text style={st.sectionTitle}>Recent Sessions</Text>
        {sessions.map(s => (
          <SessionCard key={s.id} session={s} />
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      <PostWorkoutLogModal
        visible={logVisible}
        onClose={handleLogClose}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: 20,
    paddingTop:     20,
    paddingBottom:  16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  heading:    { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.8 },
  headingSub: { fontSize: 13, color: C.textSub, marginTop: 3 },
  logBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.accent,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: R.btn,
  },
  logBtnText: { fontSize: 13, fontWeight: '800', color: C.bg },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 26 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  statVal: { fontSize: 22, fontWeight: '900', color: C.text },
  statLab: { fontSize: 11, color: C.textSub, marginTop: 4, fontWeight: '600' },

  // Section title
  sectionTitle: { ...T.section, color: C.text, marginBottom: 12 },

  // Progress cards
  progressCard: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         16,
    marginBottom:    10,
  },
  progressCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  progressLabel:   { fontSize: 11, fontWeight: '700', color: C.textSub, marginBottom: 4, letterSpacing: 0.5 },
  deltaBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  deltaText:       { fontSize: 11, fontWeight: '800' },
  progressPeak:    { fontSize: 28, fontWeight: '900', color: C.text },
  progressUnit:    { fontSize: 13, color: C.textSub, fontWeight: '600' },
  progressEmpty:   { fontSize: 13, color: C.textDim },

  // Frequency card
  freqCard: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         16,
    marginBottom:    26,
  },
  freqTitle: { ...T.section, color: C.text },
  freqSub:   { fontSize: 12, color: C.textDim, marginTop: 3 },

  // Session cards
  sessionCard: {
    flexDirection:   'row',
    gap:             14,
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         14,
    marginBottom:    10,
  },
  thumb: { width: 68, height: 68, borderRadius: 14, overflow: 'hidden' },
  thumbPhoto: {
    flex: 1,
    backgroundColor: C.accentBg,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
  },
  thumbPhotoLabel: { fontSize: 9, fontWeight: '700', color: C.accent },
  thumbEmpty: {
    flex: 1,
    backgroundColor: C.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },

  sessionCardRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 },
  sessionGym:      { fontSize: 14, fontWeight: '800', color: C.text, flex: 1, marginRight: 8 },
  sessionDate:     { fontSize: 11, color: C.textSub },

  sessionMuscles:  { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  muscleTag:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.surfaceHigh },
  muscleTagText:   { fontSize: 10, fontWeight: '600', color: C.textSub },
  muscleTagMore:   { fontSize: 10, color: C.textDim, alignSelf: 'center' },

  sessionFooterRow:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionMeta:     { fontSize: 11, color: C.textDim },
  sessionVol:      { fontSize: 11, fontWeight: '700', color: C.accent },
  sessionBw:       { fontSize: 11, color: C.textDim },
});
