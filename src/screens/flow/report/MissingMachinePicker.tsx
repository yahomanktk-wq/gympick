import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, PixelRatio } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { getMachineImageUrl } from '../../../lib/machineImageUrl';

// 2026-11-02: 머신 이름만으로는 헷갈리니 썸네일을 같이 보여준다.
const THUMB = 44;
// 기기 픽셀 비율만큼 키워서 요청해야 선명하다(가로·세로 모두 지정 — 정사각형 유지)
const THUMB_PX = Math.round(THUMB * PixelRatio.get());

/**
 * 정보 제보 > "이 머신 없어요" — 헬스장 보유 머신 중 실제로 없는 머신을 고르는 목록.
 * 검색 입력이 있으므로 한글 입력 문제를 피하려고 모듈 레벨 컴포넌트로 분리했다.
 */
export interface PickerMachine {
  id:           string;
  name:         string;
  displayName?: string;
  brand:        string;
  blurhash?:    string;
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
              {/* 이미지가 없거나 못 불러오면 아래 아이콘이 그대로 보인다 */}
              <View style={s.thumb}>
                <Ionicons name="barbell-outline" size={18} color="#b5b5c0" />
                <ExpoImage
                  source={{ uri: getMachineImageUrl(m.id, { width: THUMB_PX, height: THUMB_PX }) }}
                  placeholder={m.blurhash ? { blurhash: m.blurhash } : undefined}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={120}
                />
              </View>
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
  // 머신 원본 이미지가 흰 배경이라 썸네일 칸도 흰색으로 맞춘다
  thumb:       {
    width: THUMB, height: THUMB, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  name:        { fontSize: 14, fontWeight: '600', color: C.text },
  brand:       { fontSize: 11, color: C.textSub, marginTop: 2 },
  empty:       { fontSize: 13, color: C.textSub, paddingVertical: 12 },
});
