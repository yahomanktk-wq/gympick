import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';

// 2026-11-16: 부위·브랜드 칩 아래에 붙는 보조 칩 줄 (세부 종류 · 라인).
// 미니멀하게 — 테두리 없는 작은 글자 칩, 선택된 것만 라임 글자 + 옅은 배경.
// 다시 누르면 선택 해제(= 전체).

export interface SubChipOption {
  value: string;
  label: string;
}

interface Props {
  /** 줄 앞의 작은 이름 (예: 종류, 라인) */
  title:    string;
  options:  SubChipOption[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  style?:   StyleProp<ViewStyle>;
  /** 칩 줄 좌우 여백 (화면마다 맞춤) */
  inset?:   number;
}

export default function SubChipRow({ title, options, selected, onSelect, style, inset = 0 }: Props) {
  if (options.length === 0) return null;
  return (
    <View style={[s.wrap, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.row, { paddingHorizontal: inset }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>{title}</Text>
        {options.map(o => {
          const on = selected === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              style={[s.chip, on && s.chipOn]}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(on ? null : o.value);
              }}
            >
              <Text style={[s.text, on && s.textOn]} numberOfLines={1}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:   { marginBottom: 6 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title:  { fontSize: 11, fontWeight: '700', color: C.textDim, marginRight: 6 },
  chip:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
  chipOn: { backgroundColor: C.accentBg },
  text:   { fontSize: 12, fontWeight: '500', color: C.textSub },
  textOn: { color: C.accent, fontWeight: '700' },
});
