import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { C, R, T } from '../../theme';
import { brandLogos } from '../../constants/brandLogos';
import { getMachineImageUrl } from '../../lib/machineImageUrl';
import { OunwanRoutine } from '../../lib/db/ounwanRoutine';
import GymPickLogo from '../GymPickLogo';

// 오운완 상세(오늘의 오운완 / 헬스장 페이지에서 연 화면)의 운동 루틴 영역 (2026-10-20).
// 운동일지 상세(JournalScreen)와 같은 구성: 통계(운동·세트·볼륨) → '운동 루틴' + 부위 칩 → 루틴 카드.
// 운동 노트는 개인 메모라 보여주지 않는다. 세트는 실제 기록한 무게×횟수를 그대로 표시.

// JournalScreen 의 부위 색상과 동일
const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:       C.tagMachine,
  Back:        C.tagBrand,
  Leg:         C.tagMuscle,
  Shoulder:    { fg: '#ffd166', bg: '#ffd16618' },
  Arms:        C.tagCategory,
  Core:        { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
  Glutes:      { fg: '#ff9ecd', bg: '#ff9ecd18' },
};
const mp = (m: string) => MUSCLE_COLORS[m] ?? { fg: C.textSub, bg: C.border };

const ENG_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function formatRoutineDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}(${ENG_DAYS[d.getDay()]})_${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 카드 헤더 배지: 머신 부위 빈도 상위 1~2개 */
function headerBadge(routine: OunwanRoutine, chips: string[]): string {
  const counts: Record<string, number> = {};
  routine.entries.forEach(e => { if (e.targetMuscle) counts[e.targetMuscle] = (counts[e.targetMuscle] ?? 0) + 1; });
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).map(([m]) => m);
  const list = sorted.length > 0 ? sorted : chips;
  return list.length > 1 ? list.slice(0, 2).join(' + ') : (list[0] ?? 'WORKOUT');
}

interface Props {
  routine:        OunwanRoutine;
  /** 루틴 데이터에 부위가 없을 때 쓰는 글의 부위 목록 */
  fallbackMuscles: string[];
  onPressGym:     () => void;
  onPressMachine: (machineId: string) => void;
}

export default function OunwanRoutineSection({ routine, fallbackMuscles, onPressGym, onPressMachine }: Props) {
  const entries   = routine.entries;
  const totalSets = entries.reduce((a, e) => a + e.sets.length, 0);
  const vol       = entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0);
  const chips     = routine.targetMuscles.length > 0
    ? routine.targetMuscles
    : (fallbackMuscles.length > 0 ? [...new Set(fallbackMuscles)] : [...new Set(entries.map(e => e.targetMuscle).filter(Boolean))]);
  const borderColor = routine.overlayTextColor ?? '#ffffff';

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      {/* 통계 */}
      <View style={st.statsRow}>
        {[
          { val: entries.length, lab: '운동' },
          { val: totalSets,      lab: '세트' },
          { val: vol > 0 ? (vol / 1000).toFixed(1) : '--', lab: '볼륨' },
        ].map((item, i, arr) => (
          <React.Fragment key={item.lab}>
            <View style={st.stat}>
              <Text style={st.statVal}>{item.val}</Text>
              <Text style={st.statLab}>{item.lab}</Text>
            </View>
            {i < arr.length - 1 && <View style={st.statDiv} />}
          </React.Fragment>
        ))}
      </View>

      {/* 운동 루틴 + 부위 칩 */}
      <View style={st.titleRow}>
        <Text style={st.sectionTitle}>운동 루틴</Text>
        <View style={st.chipWrap}>
          {chips.map(m => {
            const col = mp(m);
            return (
              <View key={m} style={[st.muscleChip, { backgroundColor: col.bg, borderColor: col.fg + '40' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: col.fg }}>{m}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 루틴 카드 */}
      <View style={[st.card, { borderColor }]}>
        <TouchableOpacity style={st.cardHeader} onPress={onPressGym} activeOpacity={0.75}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={[st.gymName, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{routine.gymName}</Text>
            <View style={[st.badge, { backgroundColor: borderColor }]}>
              <Text style={st.badgeText}>{headerBadge(routine, chips)}</Text>
            </View>
          </View>
          <Text style={st.date}>{formatRoutineDate(routine.date)}</Text>
        </TouchableOpacity>
        <View style={st.divider} />

        {entries.map((e, i) => {
          const brandKey  = e.machineBrand.toUpperCase().replace(/\s+/g, '_');
          const brandLogo = brandLogos[brandKey];
          return (
            <React.Fragment key={`${e.machineId}-${i}`}>
              {i > 0 && <View style={st.divider} />}
              <TouchableOpacity
                style={st.row}
                activeOpacity={0.8}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPressMachine(e.machineId); }}
              >
                <View style={st.imgWrap}>
                  <Image
                    source={{ uri: getMachineImageUrl(e.machineId, { width: 128 }) }}
                    style={{ width: '100%', height: '100%', backgroundColor: '#FFFFFF' }}
                    contentFit="contain"
                  />
                </View>
                <View style={st.info}>
                  <Text style={st.machineName} numberOfLines={2}>{e.machineName}</Text>
                  {brandLogo ? (
                    <Image source={brandLogo} style={st.brandLogo} contentFit="contain" />
                  ) : (
                    <Text style={st.brandText}>{e.machineBrand}</Text>
                  )}
                </View>
                <View style={st.sets}>
                  {e.sets.map((s, si) => (
                    <Text key={si} style={st.setLine}>
                      {s.weight > 0 ? `${s.weight}kg` : '--'} × {s.reps}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}

        <View style={st.footer}>
          <GymPickLogo color="#000000" width={60} height={6} />
        </View>
      </View>
    </View>
  );
}

// JournalScreen 상세 스타일(det.*)과 같은 값
const st = StyleSheet.create({
  statsRow: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.card, paddingVertical: 16, marginBottom: 16 },
  stat:     { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 20, fontWeight: '900', color: C.accent },
  statLab:  { fontSize: 10, color: C.textSub, fontWeight: '600', marginTop: 3 },
  statDiv:  { width: 1, backgroundColor: C.border },

  titleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { ...T.section, color: C.text },
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', flex: 1, marginLeft: 8 },
  muscleChip:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },

  card:       { backgroundColor: '#FFFFFF', borderRadius: R.card, overflow: 'hidden', marginBottom: 20, borderWidth: 3 },
  cardHeader: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  gymName:    { fontSize: 15, fontWeight: '900', color: '#111111', letterSpacing: -0.3, marginBottom: 2 },
  date:       { fontSize: 11, color: '#888888', fontWeight: '500' },
  badge:      { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:  { fontSize: 10, fontWeight: '800', color: '#000000', letterSpacing: 0.5, textTransform: 'uppercase' },
  divider:    { height: 1, backgroundColor: '#E5E5E5' },
  row:        { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 },
  imgWrap:    { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border },
  info:       { flex: 1, justifyContent: 'center' },
  machineName:{ fontSize: 12, fontWeight: '700', color: '#000000', lineHeight: 16, marginBottom: 4 },
  brandLogo:  { width: 56, height: 18, marginTop: 4 },
  brandText:  { fontSize: 10, color: '#333333', marginTop: 4 },
  sets:       { alignItems: 'flex-end', justifyContent: 'center', minWidth: 80 },
  setLine:    { fontSize: 11, fontWeight: '600', color: '#000000', lineHeight: 18 },
  footer:     { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-end', backgroundColor: '#FFFFFF' },
});
