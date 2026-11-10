import React, { useState } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { VISIBILITY_META, type FeedVisibility } from '../../lib/feedVisibility';
import VisibilitySheet from './visibility/VisibilitySheet';

// 내 오운완 상세(오늘의 오운완 / 헬스장 페이지에서 연 경우)의 공개 범위 버튼.
// 2026-10-20: '공개중' → 비공개 전환만 → 2026-11-09: 전체 공개 / 우리 헬스장만 / 나만 보기 중 선택

interface Props {
  postId:    string;
  gymId:     string;
  value:     FeedVisibility;
  onChanged: (visibility: FeedVisibility) => void;
}

export default function OwnerVisibilityButton({ postId, gymId, value, onChanged }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const meta = VISIBILITY_META[value];

  return (
    <>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(true); }}
        activeOpacity={0.8}
        // 2026-11-09: 하트와 같은 줄 오른쪽에 들어가도록 내용 길이만큼만 (가로 꽉 채우던 버튼 → 알약형)
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          paddingHorizontal: 14, paddingVertical: 9,
          borderRadius: R.pill, borderWidth: 1,
          borderColor: C.accent + '60', backgroundColor: C.accentBg,
        }}
      >
        <Ionicons name={meta.icon} size={16} color={C.accent} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.accent }}>{meta.label}</Text>
        <Ionicons name="chevron-down" size={14} color={C.accent} />
      </TouchableOpacity>
      <VisibilitySheet
        visible={open}
        postId={postId}
        gymId={gymId}
        userId={user?.id}
        value={value}
        onClose={() => setOpen(false)}
        onChanged={onChanged}
      />
    </>
  );
}
