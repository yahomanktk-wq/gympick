import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R, T } from '../theme';
import { WorkoutLog } from '../data/types';
import { extractCompletedTargets } from '../lib/splitUtils';

// 2026-10-16: 로그인 + 운동일지 작성 경험이 있는 유저가 홈 화면에 들어왔을 때,
// "이전에 이 부위를 어떻게 했었는지" 참고할 수 있도록 가장 최근 운동일지 1건을
// 팝업으로 보여주는 컴포넌트. 어떤 세션을 고를지는 src/lib/recentWorkoutPopup.ts의
// pickRecentWorkoutForPopup이 미리 정해서 넘겨준다 — 이 컴포넌트는 순수하게
// 받은 세션을 보여주는 역할만 한다.

const MAX_MACHINES_SHOWN = 5;

interface Props {
  visible:       boolean;
  session:       WorkoutLog | null;
  matchedMuscle: boolean;
  todayTarget:   string | null; // 한글 부위명 (매칭된 경우 타이틀에 사용)
  onClose:       () => void;
  onViewDetail:  (sessionId: string) => void;
}

function formatRelativeDate(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000
  );
  if (diffDays <= 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7)   return `${diffDays}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function RecentWorkoutSummaryPopup({
  visible, session, matchedMuscle, todayTarget, onClose, onViewDetail,
}: Props) {
  if (!session) return null;

  const muscles = matchedMuscle && todayTarget
    ? [todayTarget]
    : [...new Set(extractCompletedTargets(session.machines))];

  const shown    = session.machines.slice(0, MAX_MACHINES_SHOWN);
  const moreCount = session.machines.length - shown.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <View style={s.centerWrap} pointerEvents="box-none">
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.headerIconWrap}>
              <Ionicons name="barbell-outline" size={20} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={2}>
                {matchedMuscle
                  ? `오늘 '${todayTarget}' 운동, 저번엔 이렇게 했어요`
                  : '가장 최근 운동일지를 참고해보세요'}
              </Text>
              <Text style={s.subLine} numberOfLines={1}>
                {session.gymName} · {formatRelativeDate(session.date)}
              </Text>
            </View>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color={C.textSub} />
            </TouchableOpacity>
          </View>

          {muscles.length > 0 && (
            <View style={s.badgeRow}>
              {muscles.map(m => (
                <View key={m} style={s.badge}>
                  <Text style={s.badgeText}>{m}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.divider} />

          <ScrollView style={s.machineList} showsVerticalScrollIndicator={false}>
            {shown.map((m, i) => (
              <View key={`${m.machineId}-${i}`} style={[s.machineRow, i > 0 && s.machineRowBorder]}>
                <Text style={s.machineName} numberOfLines={1}>{m.machineName}</Text>
                <Text style={s.machineStat}>
                  {m.weight > 0 ? `${m.weight}kg` : '--'} × {m.reps} · {m.sets}세트
                </Text>
              </View>
            ))}
            {moreCount > 0 && (
              <Text style={s.moreText}>+{moreCount}개 더</Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={s.cta}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onViewDetail(session.id); }}
          >
            <Text style={s.ctaText}>자세히 보기</Text>
            <Ionicons name="chevron-forward" size={16} color={C.bg} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 12,
  },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.accentBg,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  title:   { ...T.body, fontWeight: '700', color: C.text, lineHeight: 20 },
  subLine: { fontSize: 12, color: C.textSub, marginTop: 3 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    backgroundColor: C.tagMuscle.bg,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.tagMuscle.fg },

  divider: { height: 1, backgroundColor: C.border },

  machineList: { maxHeight: 190 },
  machineRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9, gap: 10,
  },
  machineRowBorder: { borderTopWidth: 1, borderTopColor: C.borderSub },
  machineName: { flex: 1, fontSize: 13, fontWeight: '600', color: C.text },
  machineStat: { fontSize: 12, color: C.textSub },
  moreText: { fontSize: 12, color: C.textDim, paddingTop: 6, paddingBottom: 2 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 13,
  },
  ctaText: { fontSize: 14, fontWeight: '800', color: C.bg },
});
