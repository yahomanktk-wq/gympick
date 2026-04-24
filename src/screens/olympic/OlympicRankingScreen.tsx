import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { MACHINES } from '../../data';
import { getRankings, OlympicRank } from '../../data/olympicStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const BODY_PARTS = ['ALL', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms'] as const;
type BodyPartFilter = (typeof BODY_PARTS)[number];

const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#5ba4ff', Back: '#cc5de8', Legs: '#ff922b',
  Shoulders: '#ffd166', Arms: '#3dd68c',
};

const MEDAL: Record<number, { icon: IoniconName; color: string }> = {
  0: { icon: 'medal',         color: '#ffd700' },
  1: { icon: 'medal-outline', color: '#c0c0c0' },
  2: { icon: 'medal-outline', color: '#cd7f32' },
};

// Enrich rank with machine metadata
function enrichRanks(ranks: OlympicRank[]): (OlympicRank & { displayName: string; brand: string })[] {
  return ranks.map((r) => {
    const m = MACHINES.find((m) => m.id === r.machineId);
    return {
      ...r,
      displayName: m ? (m.displayName ?? m.name) : r.machineId,
      brand: m?.brand ?? '',
      machineName: m?.name ?? r.machineId,
      machineBrand: m?.brand ?? '',
    };
  });
}

interface Props {
  gymId?: string | null;
  onBack: () => void;
  onClose: () => void;
}

export default function OlympicRankingScreen({ gymId, onBack, onClose }: Props) {
  const [activeBodyPart, setActiveBodyPart] = useState<BodyPartFilter>('ALL');
  const [scope, setScope] = useState<'global' | 'gym'>('global');

  const ranks = useMemo(() => {
    const bodyParts = activeBodyPart === 'ALL'
      ? ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms']
      : [activeBodyPart];

    const combined: OlympicRank[] = [];
    for (const bp of bodyParts) {
      combined.push(...getRankings(bp));
    }

    // Deduplicate by machineId (take best winRate)
    const deduped = Object.values(
      combined.reduce<Record<string, OlympicRank>>((acc, r) => {
        if (!acc[r.machineId] || r.winRate > acc[r.machineId].winRate) {
          acc[r.machineId] = r;
        }
        return acc;
      }, {}),
    ).sort((a, b) => b.winRate - a.winRate || b.winCount - a.winCount);

    return enrichRanks(deduped);
  }, [activeBodyPart]);

  const accentForBodyPart = activeBodyPart !== 'ALL' ? (MUSCLE_COLORS[activeBodyPart] ?? C.accent) : C.accent;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      {/* Nav */}
      <View style={s.nav}>
        <TouchableOpacity style={s.navBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>머신 랭킹</Text>
        <TouchableOpacity style={s.navBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.textSub} />
        </TouchableOpacity>
      </View>

      {/* Scope toggle */}
      <View style={s.scopeRow}>
        <TouchableOpacity
          style={[s.scopeBtn, scope === 'global' && s.scopeBtnActive]}
          onPress={() => setScope('global')}
        >
          <Text style={[s.scopeBtnText, scope === 'global' && s.scopeBtnTextActive]}>전체</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.scopeBtn, scope === 'gym' && s.scopeBtnActive]}
          onPress={() => setScope('gym')}
        >
          <Text style={[s.scopeBtnText, scope === 'gym' && s.scopeBtnTextActive]}>내 헬스장</Text>
        </TouchableOpacity>
      </View>

      {/* Body part filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {BODY_PARTS.map((bp) => {
          const active = activeBodyPart === bp;
          const color  = bp !== 'ALL' ? MUSCLE_COLORS[bp] : C.accent;
          return (
            <TouchableOpacity
              key={bp}
              style={[s.filterChip, active && { backgroundColor: color + '18', borderColor: color + '50' }]}
              onPress={() => setActiveBodyPart(bp)}
            >
              <Text style={[s.filterChipText, active && { color }]}>{bp}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Ranking list */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        {ranks.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="podium-outline" size={40} color={C.textDim} />
            <Text style={s.emptyText}>아직 투표 데이터가 없어요</Text>
            <Text style={s.emptyHint}>배틀에 참여하면 랭킹이 생성됩니다</Text>
          </View>
        ) : (
          ranks.map((rank, index) => {
            const medal = MEDAL[index];
            const bpColor = MUSCLE_COLORS[rank.bodyPart] ?? C.textSub;
            return (
              <View key={rank.machineId} style={s.rankRow}>
                {/* Rank number / medal */}
                <View style={s.rankNumWrap}>
                  {medal ? (
                    <Ionicons name={medal.icon} size={20} color={medal.color} />
                  ) : (
                    <Text style={s.rankNum}>{index + 1}</Text>
                  )}
                </View>

                {/* Info */}
                <View style={s.rankInfo}>
                  <Text style={s.rankName} numberOfLines={1}>{rank.displayName}</Text>
                  <View style={s.rankMeta}>
                    <Text style={s.rankBrand}>{rank.brand}</Text>
                    {activeBodyPart === 'ALL' && (
                      <View style={[s.rankBpTag, { backgroundColor: bpColor + '18' }]}>
                        <Text style={[s.rankBpText, { color: bpColor }]}>{rank.bodyPart}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Stats */}
                <View style={s.rankStats}>
                  <Text style={[s.rankWinRate, { color: accentForBodyPart }]}>{rank.winRate}%</Text>
                  <Text style={s.rankRecord}>{rank.winCount}승 {rank.loseCount}패</Text>
                  {/* Win rate bar */}
                  <View style={s.winBar}>
                    <View style={[s.winBarFill, { width: `${rank.winRate}%`, backgroundColor: accentForBodyPart }]} />
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  navBtn:   { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  scopeRow: {
    flexDirection: 'row', margin: 12, gap: 8,
    backgroundColor: C.surface, borderRadius: R.pill,
    padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
  },
  scopeBtn:          { flex: 1, paddingVertical: 7, borderRadius: R.pill, alignItems: 'center' },
  scopeBtnActive:    { backgroundColor: C.accent },
  scopeBtnText:      { ...T.label, color: C.textSub, fontWeight: '600' },
  scopeBtnTextActive:{ color: C.bg, fontWeight: '700' },

  filterRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
  },
  filterChipText: { ...T.label, color: C.textSub },

  listPad: { paddingHorizontal: 16 },

  rankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: R.inner,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    padding: 12, marginBottom: 8,
  },
  rankNumWrap: { width: 28, alignItems: 'center' },
  rankNum:     { fontSize: 15, fontWeight: '800', color: C.textSub },

  rankInfo:  { flex: 1, gap: 4 },
  rankName:  { ...T.body, color: C.text, fontWeight: '600' },
  rankMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankBrand: { ...T.micro, color: C.textDim },
  rankBpTag: { borderRadius: R.pill, paddingHorizontal: 6, paddingVertical: 2 },
  rankBpText:{ ...T.micro, fontWeight: '700' },

  rankStats:   { alignItems: 'flex-end', gap: 3, minWidth: 72 },
  rankWinRate: { fontSize: 16, fontWeight: '900' },
  rankRecord:  { ...T.micro, color: C.textDim },
  winBar:      { width: 64, height: 3, backgroundColor: C.surfaceHigh, borderRadius: 2, overflow: 'hidden' },
  winBarFill:  { height: 3, borderRadius: 2 },

  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:{ ...T.section, color: C.textSub },
  emptyHint:{ ...T.label, color: C.textDim },
});
