import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { Machine } from '../../data/types';
import { OlympicVote, getMachineRecord } from '../../data/olympicStore';
import OlympicTradingCard from './OlympicTradingCard';

const { width: SCREEN_W } = Dimensions.get('window');
const WINNER_CARD_W = Math.min(SCREEN_W - 64, 280);

const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#5ba4ff', Back: '#cc5de8', Legs: '#ff922b',
  Shoulders: '#ffd166', Arms: '#3dd68c',
};

interface Props {
  winner: Machine;
  bodyPart: string;
  allVotes: OlympicVote[];
  onViewRankings: () => void;
  onRestart: () => void;
  onHome: () => void;
  onClose: () => void;
}

export default function OlympicResultScreen({
  winner, bodyPart, allVotes, onViewRankings, onRestart, onHome, onClose,
}: Props) {
  const accentColor = MUSCLE_COLORS[bodyPart] ?? C.accent;
  const record      = getMachineRecord(winner.id);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      {/* Nav */}
      <View style={s.nav}>
        <View style={s.navBtn} />
        <Text style={s.navTitle}>결과</Text>
        <TouchableOpacity style={s.navBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.textSub} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Trophy */}
        <View style={s.trophySection}>
          <View style={[s.trophyCircle, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
            <Ionicons name="trophy" size={52} color={accentColor} />
          </View>
          <Text style={[s.championLabel, { color: accentColor }]}>
            오늘의 {bodyPart} 챔피언
          </Text>
          <Text style={s.sessionInfo}>{allVotes.length}번의 배틀 중 최후 승자</Text>
        </View>

        {/* Winner trading card — centered, read-only */}
        <View style={s.winnerCardWrap}>
          <OlympicTradingCard
            machine={winner}
            width={WINNER_CARD_W}
            selected
            selectedColor={accentColor}
            readOnly
          />
        </View>

        {/* Record */}
        <View style={s.recordRow}>
          <View style={s.recordItem}>
            <Text style={[s.recordNum, { color: accentColor }]}>{record.wins}승</Text>
            <Text style={s.recordSub}>누적 승리</Text>
          </View>
          <View style={s.recordDivider} />
          <View style={s.recordItem}>
            <Text style={[s.recordNum, { color: accentColor }]}>{record.winRate}%</Text>
            <Text style={s.recordSub}>승률</Text>
          </View>
          <View style={s.recordDivider} />
          <View style={s.recordItem}>
            <Text style={[s.recordNum, { color: accentColor }]}>{record.losses}패</Text>
            <Text style={s.recordSub}>패배</Text>
          </View>
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: accentColor }]}
          onPress={onViewRankings}
          activeOpacity={0.85}
        >
          <Ionicons name="podium-outline" size={18} color={C.bg} />
          <Text style={s.primaryBtnText}>전체 투표 결과 보기</Text>
        </TouchableOpacity>

        <View style={s.secondaryRow}>
          <TouchableOpacity style={s.secondaryBtn} onPress={onRestart} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={17} color={C.text} />
            <Text style={s.secondaryBtnText}>다시 하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={onHome} activeOpacity={0.8}>
            <Ionicons name="home-outline" size={17} color={C.text} />
            <Text style={s.secondaryBtnText}>홈으로</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  navBtn:   { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  trophySection: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  trophyCircle:  {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
  championLabel: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  sessionInfo:   { ...T.label, color: C.textDim },

  winnerCardWrap: { alignItems: 'center', marginBottom: 20 },

  recordRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, marginBottom: 24,
  },
  recordItem:    { alignItems: 'center', gap: 3 },
  recordNum:     { fontSize: 22, fontWeight: '900' },
  recordSub:     { ...T.micro, color: C.textDim },
  recordDivider: { width: 1, height: 32, backgroundColor: C.border },

  primaryBtn: {
    borderRadius: R.btn, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 12,
  },
  primaryBtnText: { ...T.body, color: C.bg, fontWeight: '800' },

  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1, height: 48,
    backgroundColor: C.surface, borderRadius: R.btn,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  secondaryBtnText: { ...T.label, color: C.text, fontWeight: '700' },
});
