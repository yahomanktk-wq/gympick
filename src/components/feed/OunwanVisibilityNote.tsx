import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../../theme';
import type { FeedVisibility } from '../../lib/feedVisibility';
import VisibilityOptionList from './visibility/VisibilityOptionList';
import { useIsGymMember } from './visibility/useIsGymMember';

// 오운완 업로드(운동 사진) 화면 하단 공개 범위 선택.
// 2026-10-20: 기본 공개 + 안내 한 줄 → 2026-11-09: 전체 공개 / 우리 헬스장만 / 나만 보기 선택 (기본 전체 공개)

interface Props {
  gymId:    string;
  userId:   string | null | undefined;
  value:    FeedVisibility;
  onChange: (v: FeedVisibility) => void;
}

export default function OunwanVisibilityNote({ gymId, userId, value, onChange }: Props) {
  const canUseGym = useIsGymMember(gymId, userId);
  return (
    <View style={{ marginTop: 16, gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, paddingHorizontal: 2 }}>공개 범위</Text>
      <VisibilityOptionList value={value} canUseGym={canUseGym} onChange={onChange} />
      <Text style={{ fontSize: 12, color: C.textSub, paddingHorizontal: 2 }}>운동일지에서 언제든 바꿀 수 있어요.</Text>
    </View>
  );
}
