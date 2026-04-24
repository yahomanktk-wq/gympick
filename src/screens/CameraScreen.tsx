import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';

// ─── Mock data ────────────────────────────────────────────────────────────────

interface ScanResult {
  name: string;
  brand: string;
  muscle: string;
  category: string;
  confidence: number;
  gym: string;
}

const MOCK_RESULT: ScanResult = {
  name:       'Cable Machine',
  brand:      'Life Fitness',
  muscle:     'Back',
  category:   'Strength',
  confidence: 94,
  gym:        'IronHub Fitness',
};

const RECENT_SCANS = [
  { id: '1', name: 'Leg Press',    brand: 'Life Fitness',    muscle: 'Legs',    time: '2h ago' },
  { id: '2', name: 'Smith Machine',brand: 'Matrix',          muscle: 'Shoulders',time: 'Yesterday' },
  { id: '3', name: 'Lat Pulldown', brand: 'Hammer Strength', muscle: 'Back',    time: '2 days ago' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  return (
    <View style={styles.confRow}>
      <Text style={styles.confLabel}>Confidence</Text>
      <View style={styles.confTrack}>
        <View style={[styles.confFill, { width: `${value}%` as any }]} />
      </View>
      <Text style={styles.confValue}>{value}%</Text>
    </View>
  );
}

function ResultCard({ result }: { result: ScanResult }) {
  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={styles.resultIconWrap}>
          <Ionicons name="checkmark-circle" size={22} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultEyebrow}>MACHINE IDENTIFIED</Text>
          <Text style={styles.resultName}>{result.name}</Text>
        </View>
      </View>

      <ConfidenceBar value={result.confidence} />

      <View style={styles.resultGrid}>
        {[
          { label: 'BRAND',    value: result.brand },
          { label: 'MUSCLE',   value: result.muscle },
          { label: 'CATEGORY', value: result.category },
          { label: 'GYM',      value: result.gym },
        ].map(({ label, value }) => (
          <View key={label} style={styles.resultCell}>
            <Text style={styles.resultCellLabel}>{label}</Text>
            <Text style={styles.resultCellValue} numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logBtn} activeOpacity={0.88}>
        <Ionicons name="add" size={16} color={C.bg} style={{ marginRight: 6 }} />
        <Text style={styles.logBtnText}>Log to Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

function RecentRow({ name, brand, muscle, time }: { name: string; brand: string; muscle: string; time: string }) {
  return (
    <TouchableOpacity style={styles.recentRow} activeOpacity={0.75}>
      <View style={styles.recentIcon}>
        <Ionicons name="scan-outline" size={15} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recentName}>{name}</Text>
        <Text style={styles.recentSub}>{brand} · {muscle}</Text>
      </View>
      <Text style={styles.recentTime}>{time}</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CameraScreen() {
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const startScan = () => {
    setScanning(true);
    setScanned(false);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ]),
    ).start();

    setTimeout(() => {
      setScanning(false);
      setScanned(true);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scan Machine</Text>
          <Text style={styles.headerSub}>Point your camera at gym equipment</Text>
        </View>

        {/* ── Viewfinder ── */}
        <View style={styles.viewfinderWrap}>
          <View style={styles.viewfinder}>
            {/* Corner brackets */}
            {[
              { top: 0,    left: 0,    borderTopWidth: 3,    borderLeftWidth: 3 },
              { top: 0,    right: 0,   borderTopWidth: 3,    borderRightWidth: 3 },
              { bottom: 0, left: 0,    borderBottomWidth: 3, borderLeftWidth: 3 },
              { bottom: 0, right: 0,   borderBottomWidth: 3, borderRightWidth: 3 },
            ].map((s, i) => (
              <View key={i} style={[styles.corner, s]} />
            ))}

            {/* Inner content */}
            <View style={styles.viewfinderInner}>
              {scanning ? (
                <Animated.View style={[styles.scanRing, { transform: [{ scale: pulseAnim }] }]}>
                  <Ionicons name="scan" size={48} color={C.accent} />
                </Animated.View>
              ) : scanned ? (
                <View style={styles.scannedBadge}>
                  <Ionicons name="checkmark-circle" size={52} color={C.accent} />
                </View>
              ) : (
                <View style={styles.idleIcon}>
                  <Ionicons name="camera-outline" size={40} color={C.textDim} />
                  <Text style={styles.idleText}>No camera in simulator</Text>
                  <Text style={styles.idleHint}>Tap Scan to see a demo result</Text>
                </View>
              )}
            </View>

            {/* Status pill */}
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, scanning && { backgroundColor: C.warning }, scanned && { backgroundColor: C.accent }]} />
              <Text style={styles.statusText}>
                {scanning ? 'Scanning…' : scanned ? 'Machine found' : 'Ready to scan'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Scan button ── */}
        {!scanned && (
          <TouchableOpacity
            style={[styles.scanBtn, scanning && { opacity: 0.6 }]}
            onPress={startScan}
            disabled={scanning}
            activeOpacity={0.85}
          >
            <Ionicons name="scan" size={18} color={C.bg} style={{ marginRight: 8 }} />
            <Text style={styles.scanBtnText}>{scanning ? 'Scanning…' : 'Scan Machine'}</Text>
          </TouchableOpacity>
        )}

        {/* ── Result card ── */}
        {scanned && (
          <>
            <ResultCard result={MOCK_RESULT} />
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={15} color={C.textSub} style={{ marginRight: 6 }} />
              <Text style={styles.rescanText}>Scan Again</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Recent scans ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent Scans</Text>
        </View>
        <View style={styles.card}>
          {RECENT_SCANS.map((s, i) => (
            <React.Fragment key={s.id}>
              <RecentRow {...s} />
              {i < RECENT_SCANS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { ...T.title, color: C.text },
  headerSub:   { fontSize: 13, color: C.textSub, marginTop: 3 },

  // Viewfinder
  viewfinderWrap: { paddingHorizontal: 20, marginBottom: 16 },
  viewfinder: {
    height: 260,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: C.accent,
  },
  viewfinderInner: { alignItems: 'center', justifyContent: 'center' },
  scanRing:        { padding: 16, borderRadius: 50, backgroundColor: C.accentBg },
  scannedBadge:    { padding: 12, borderRadius: 50, backgroundColor: C.accentBg },
  idleIcon:        { alignItems: 'center', gap: 8 },
  idleText:        { fontSize: 14, fontWeight: '600', color: C.textSub },
  idleHint:        { fontSize: 12, color: C.textDim },

  statusPill: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
  },
  statusDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: C.textDim },
  statusText: { fontSize: 12, fontWeight: '600', color: C.textSub },

  // Buttons
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: R.btn,
    marginBottom: 24,
  },
  scanBtnText: { fontSize: 16, fontWeight: '800', color: C.bg },

  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 28,
    paddingVertical: 13,
    borderRadius: R.btn,
    borderWidth: 1,
    borderColor: C.border,
  },
  rescanText: { fontSize: 14, fontWeight: '600', color: C.textSub },

  // Result card
  resultCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    marginHorizontal: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.accent + '40',
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  resultIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: C.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultEyebrow: { ...T.micro, color: C.accent, marginBottom: 2 },
  resultName:    { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  confRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  confLabel: { fontSize: 11, fontWeight: '600', color: C.textSub, width: 74 },
  confTrack: { flex: 1, height: 5, backgroundColor: C.surfaceHigh, borderRadius: 3, overflow: 'hidden' },
  confFill:  { height: '100%', backgroundColor: C.accent, borderRadius: 3 },
  confValue: { fontSize: 12, fontWeight: '700', color: C.accent, width: 34, textAlign: 'right' },

  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  resultCell: {
    width: '47%',
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    padding: 12,
  },
  resultCellLabel: { ...T.micro, color: C.textDim, marginBottom: 4 },
  resultCellValue: { fontSize: 13, fontWeight: '700', color: C.text },

  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    paddingVertical: 13,
    borderRadius: R.btn,
  },
  logBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },

  // Recent
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 10 },
  sectionTitle: { ...T.section, color: C.text },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  divider:    { height: 1, backgroundColor: C.border, marginLeft: 58 },
  recentRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentName: { fontSize: 14, fontWeight: '700', color: C.text },
  recentSub:  { fontSize: 12, color: C.textSub, marginTop: 2 },
  recentTime: { fontSize: 11, color: C.textDim, fontWeight: '600' },
});
