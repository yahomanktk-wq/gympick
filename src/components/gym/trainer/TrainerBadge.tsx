import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';

// 2026-11-09: 닉네임 앞에 붙는 '트레이너' / '관장님' 배지

export type StaffBadgeKind = 'trainer' | 'owner';

const LABEL: Record<StaffBadgeKind, string> = { trainer: '트레이너', owner: '관장님' };

export default function TrainerBadge({ kind }: { kind: StaffBadgeKind }) {
  return (
    <View style={s.badge}>
      <Ionicons name={kind === 'owner' ? 'shield-checkmark' : 'fitness'} size={10} color={C.bg} />
      <Text style={s.text}>{LABEL[kind]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.accent, borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 2 },
  text:  { color: C.bg, fontSize: 10, fontWeight: '800' },
});
