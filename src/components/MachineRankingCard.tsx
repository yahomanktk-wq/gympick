import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { C, R } from '../theme';
import { MachineRankingEntry } from '../data/types';
import { brandLogos } from '../constants/brandLogos';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  entry:    MachineRankingEntry;
  onPress?: () => void;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const RANK_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const CHANGE_META: Record<MachineRankingEntry['usageChange'], { symbol: string; color: string }> = {
  up:   { symbol: '▲', color: C.accent    },
  down: { symbol: '▼', color: '#FF5252'   },
  same: { symbol: '—', color: C.textDim   },
};

// ── Sub-components (module-level) ─────────────────────────────────────────────

function RankLabel({ rank }: { rank: number }) {
  return (
    <Text style={s.rank}>{RANK_EMOJI[rank] ?? `#${rank}`}</Text>
  );
}

function ChangeIcon({ change }: { change: MachineRankingEntry['usageChange'] }) {
  const meta = CHANGE_META[change];
  return (
    <Text style={[s.changeIcon, { color: meta.color }]}>{meta.symbol}</Text>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MachineRankingCard({ entry, onPress }: Props) {
  const usageLabel  = entry.usageCount.toLocaleString() + '회';
  const brandKey    = entry.brandName.toUpperCase().replace(/\s+/g, '_');
  const logoSource  = brandLogos[brandKey];

  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Top row: rank + change icon */}
      <View style={s.topRow}>
        <RankLabel rank={entry.rank} />
        <ChangeIcon change={entry.usageChange} />
      </View>

      {/* Machine name */}
      <Text style={s.machineName} numberOfLines={2}>{entry.machineName}</Text>

      {/* Bottom row: 흰색 배경으로 시인성 향상 */}
      <View style={s.bottomWrap}>
        <View style={s.bottomRow}>
          {logoSource ? (
            <Image source={logoSource} style={s.brandLogo} contentFit="contain" />
          ) : (
            <Text style={s.brandNameDark} numberOfLines={1}>{entry.brandName}</Text>
          )}
          <Text style={s.usageCountDark}>{usageLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    width:           160,
    height:          100,
    backgroundColor: C.surface,
    borderRadius:    R.card,
    overflow:        'hidden',
    justifyContent:  'space-between',
  },

  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: 12,
    paddingTop:        12,
  },
  rank: {
    fontSize: 16,
  },
  changeIcon: {
    fontSize:   12,
    fontWeight: '800',
  },

  machineName: {
    fontSize:    13,
    fontWeight:  '700',
    color:       C.text,
    lineHeight:  17,
    flex:        1,
    marginVertical: 1,
    paddingHorizontal: 12,
  },

  bottomWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical:   8,
    marginTop:         'auto' as any,
  },
  bottomRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            4,
  },
  brandLogo: {
    width:   56,
    height:  18,
  },
  brandName: {
    flex:       1,
    fontSize:   10,
    color:      C.textSub,
    fontWeight: '500',
  },
  brandNameDark: {
    flex:       1,
    fontSize:   10,
    color:      '#000000',
    fontWeight: '600',
  },
  usageCount: {
    fontSize:   10,
    color:      C.textDim,
    fontWeight: '500',
  },
  usageCountDark: {
    fontSize:   10,
    color:      '#000000',
    fontWeight: '700',
  },
});
