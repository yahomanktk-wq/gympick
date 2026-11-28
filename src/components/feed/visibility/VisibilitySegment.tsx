import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { VISIBILITY_META, VISIBILITY_ORDER, type FeedVisibility } from '../../../lib/feedVisibility';

// 2026-11-28: 운동 사진(오운완 업로드) 화면용 공개 범위 — 가로 3칸 선택 + 아래 설명 한 줄
// (운동일지의 공개 범위 변경 시트는 기존 세로 목록 VisibilityOptionList 그대로)
// '우리 헬스장만'은 그 헬스장 회원일 때만 고를 수 있고, 잠긴 칸을 누르면 이유를 아래에 보여준다.

interface Props {
  value:     FeedVisibility;
  /** null = 확인 중 */
  canUseGym: boolean | null;
  onChange:  (v: FeedVisibility) => void;
}

export default function VisibilitySegment({ value, canUseGym, onChange }: Props) {
  const [lockNote, setLockNote] = useState<string | null>(null);

  const desc = lockNote ?? VISIBILITY_META[value].desc;

  return (
    <View style={{ gap: 8 }}>
      <View style={s.row}>
        {VISIBILITY_ORDER.map(v => {
          const meta = VISIBILITY_META[v];
          const locked = v === 'gym' && canUseGym !== true;
          const selected = value === v;
          return (
            <TouchableOpacity
              key={v}
              style={[s.seg, selected && s.segSelected, locked && { opacity: 0.45 }]}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (locked) {
                  setLockNote(canUseGym === null ? '회원 여부를 확인하고 있어요…' : '우리 헬스장만은 이 헬스장 회원만 고를 수 있어요 (헬스장 상세에서 가입)');
                  return;
                }
                setLockNote(null);
                onChange(v);
              }}
            >
              <Ionicons name={locked ? 'lock-closed-outline' : meta.icon} size={16} color={selected ? C.accent : C.textSub} />
              <Text style={[s.label, selected && { color: C.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[s.desc, lockNote && { color: C.warning }]}>{desc}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 8 },
  seg:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 4, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  segSelected: { borderColor: C.accent + '70', backgroundColor: C.accentBg },
  label:       { color: C.text, fontSize: 13, fontWeight: '700' },
  desc:        { color: C.textSub, fontSize: 12, paddingHorizontal: 2, lineHeight: 17 },
});
