import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';

/**
 * 정보 제보 > "이 머신 없어요" — 헬스장 보유 머신 중 실제로 없는 머신을 고르는 목록.
 * 검색 입력이 있으므로 한글 입력 문제를 피하려고 모듈 레벨 컴포넌트로 분리했다.
 */
export interface PickerMachine {
  id:           string;
  name:         string;
  displayName?: string;
  brand:        string;
}

interface Props {
  machines:    PickerMachine[];
  selectedIds: string[];
  onToggle:    (id: string) => void;
}

function labelOf(m: PickerMachine): string {
  return m.displayName || m.name;
}

export function MissingMachinePicker({ machines, selectedIds, onToggle }: Props) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...machines].sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
    if (!q) return sorted;
    return sorted.filter(m =>
      labelOf(m).toLowerCase().includes(q) || (m.brand ?? '').toLowerCase().includes(q),
    );
  }, [machines, query]);

  if (machines.length === 0) {
    return <Text style={s.empty}>이 헬스장에 등록된 머신이 없어요.</Text>;
  }

  return (
    <View style={s.wrap}>
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={C.textSub} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="머신 이름이나 브랜드로 검색"
          placeholderTextColor={C.textSub}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />
      </View>

      <Text style={s.count}>
        {selectedIds.length > 0 ? `${selectedIds.length}개 선택됨` : '실제로 없는 머신을 모두 골라주세요'}
      </Text>

      <View style={s.list}>
        {filtered.length === 0 && <Text style={s.empty}>검색 결과가 없어요.</Text>}
        {filtered.map(m => {
          const on = selected.has(m.id);
          return (
            <TouchableOpacity
              key={m.id}
              style={[s.row, on && s.rowOn]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(m.id); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={20}
                color={on ? C.accent : C.textSub}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.name, on && { color: C.accent }]} numberOfLines={1}>{labelOf(m)}</Text>
                <Text style={s.brand} numberOfLines={1}>{m.brand}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { marginBottom: 20 },
  searchBox:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface, borderRadius: R.inner,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14, padding: 0 },
  count:       { fontSize: 12, color: C.textSub, marginTop: 10, marginBottom: 8 },
  list:        { gap: 6 },
  row:         {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: R.inner,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  rowOn:       { borderColor: C.accent, backgroundColor: C.accentBg },
  name:        { fontSize: 14, fontWeight: '600', color: C.text },
  brand:       { fontSize: 11, color: C.textSub, marginTop: 2 },
  empty:       { fontSize: 13, color: C.textSub, paddingVertical: 12 },
});
