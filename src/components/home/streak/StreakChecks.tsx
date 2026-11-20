// 2026-11-21: 연속 기록 카드 오른쪽 체크 줄 (이번 주 / 요일형 / 순서형)

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../../theme';
import type { CheckItem, CheckRow } from '../../../lib/streak/weekChecks';

const DOT = 26;
const SCROLL_ITEM_W = 40;
const MAX_FIT = 7;

const CheckDot = React.memo(({ item }: { item: CheckItem }) => (
  <View
    style={[
      st.dot,
      item.checked && st.dotChecked,
      !item.checked && item.isCurrent && st.dotCurrent,
    ]}
  >
    {item.checked ? (
      <Ionicons name="checkmark" size={15} color={C.bg} />
    ) : item.isRest ? (
      <Ionicons name="moon-outline" size={11} color={C.textDim} />
    ) : null}
  </View>
));

const CheckCell = React.memo(({ item, fixedWidth }: { item: CheckItem; fixedWidth?: number }) => (
  <View style={[st.cell, fixedWidth ? { width: fixedWidth } : st.cellFlex]}>
    <CheckDot item={item} />
    <Text
      style={[st.label, item.isCurrent && st.labelCurrent]}
      numberOfLines={1}
    >
      {item.label}
    </Text>
    {item.subLabel !== undefined && (
      <Text style={[st.sub, item.isRest && st.subRest]} numberOfLines={1}>
        {item.subLabel}
      </Text>
    )}
  </View>
));

export default function StreakChecks({ row }: { row: CheckRow }) {
  const scroll = row.items.length > MAX_FIT;
  return (
    <View style={st.wrap}>
      <Text style={st.title}>{row.title}</Text>
      <View style={st.panel}>
        {scroll ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
            {row.items.map(item => <CheckCell key={item.key} item={item} fixedWidth={SCROLL_ITEM_W} />)}
          </ScrollView>
        ) : (
          <View style={st.rowFit}>
            {row.items.map(item => <CheckCell key={item.key} item={item} />)}
          </View>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap:   { flex: 1, minWidth: 0, justifyContent: 'center' },
  title:  { fontSize: 12, fontWeight: '700', color: C.textSub, marginBottom: 8, marginLeft: 2 },
  panel:  { backgroundColor: C.surfaceHigh, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4 },
  rowFit: { flexDirection: 'row', justifyContent: 'space-between' },
  scrollContent: { paddingHorizontal: 2 },

  cell:     { alignItems: 'center', gap: 4 },
  cellFlex: { flex: 1, minWidth: 0 },

  dot: {
    width: DOT, height: DOT, borderRadius: DOT / 2,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  dotChecked: { backgroundColor: C.accent },
  dotCurrent: { borderWidth: 1.5, borderColor: C.accent },

  label:        { fontSize: 11, fontWeight: '700', color: C.textSub },
  labelCurrent: { color: C.accent },
  sub:          { fontSize: 9, fontWeight: '600', color: C.textSub, maxWidth: '100%' },
  subRest:      { color: C.textDim },
});
