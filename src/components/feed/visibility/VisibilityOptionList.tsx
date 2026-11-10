import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { VISIBILITY_META, VISIBILITY_ORDER, type FeedVisibility } from '../../../lib/feedVisibility';

// 2026-11-09: 공개 범위 3가지 선택 목록 (업로드 화면 · 공개 범위 변경 시트 공용)
// '우리 헬스장만'은 그 헬스장 회원일 때만 고를 수 있다.

interface Props {
  value:        FeedVisibility;
  /** null = 확인 중 */
  canUseGym:    boolean | null;
  onChange:     (v: FeedVisibility) => void;
}

export default function VisibilityOptionList({ value, canUseGym, onChange }: Props) {
  return (
    <View style={s.list}>
      {VISIBILITY_ORDER.map(v => {
        const meta = VISIBILITY_META[v];
        const locked = v === 'gym' && canUseGym !== true;
        const selected = value === v;
        return (
          <TouchableOpacity
            key={v}
            style={[s.row, selected && s.rowSelected, locked && { opacity: 0.45 }]}
            activeOpacity={0.8}
            disabled={locked}
            onPress={() => onChange(v)}
          >
            <Ionicons name={meta.icon} size={18} color={selected ? C.accent : C.textSub} />
            <View style={{ flex: 1 }}>
              <Text style={[s.label, selected && { color: C.accent }]}>{meta.label}</Text>
              <Text style={s.desc}>
                {locked ? (canUseGym === null ? '확인 중…' : '이 헬스장 회원만 고를 수 있어요 (헬스장 상세에서 가입)') : meta.desc}
              </Text>
            </View>
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? C.accent : C.textDim} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list:        { gap: 8 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  rowSelected: { borderColor: C.accent + '70', backgroundColor: C.accentBg },
  label:       { color: C.text, fontSize: 14, fontWeight: '700' },
  desc:        { color: C.textSub, fontSize: 12, marginTop: 2 },
});
