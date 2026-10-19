import React, { useState } from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';
import { setFeedPostVisibility } from '../../lib/db/feedPosts';

// 내 오운완 상세(오늘의 오운완 / 헬스장 페이지에서 연 경우)의 '공개중' 버튼 (2026-10-20).
// 이 화면들은 공개된 글만 보여주므로 여기서는 '비공개로 바꾸기'만 한다.
// 다시 공개하는 건 운동일지 상세에서 한다.

interface Props {
  postId:    string;
  onChanged: (isPublic: boolean) => void;
}

export default function OwnerVisibilityButton({ postId, onChanged }: Props) {
  const [saving, setSaving] = useState(false);

  function confirmMakePrivate() {
    if (saving) return;
    Alert.alert(
      '비공개로 바꿀까요?',
      '오늘의 오운완과 헬스장 페이지에서 보이지 않게 돼요. 운동일지에서 다시 공개할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '비공개',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await setFeedPostVisibility(postId, false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChanged(false);
            } catch {
              Alert.alert('오류', '공개 여부 변경에 실패했어요.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  return (
    <TouchableOpacity
      onPress={confirmMakePrivate}
      disabled={saving}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginHorizontal: 16, marginTop: 12,
        paddingVertical: 11,
        borderRadius: R.btn, borderWidth: 1,
        borderColor: C.accent + '60', backgroundColor: C.accentBg,
        opacity: saving ? 0.6 : 1,
      }}
    >
      <Ionicons name="eye-outline" size={16} color={C.accent} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.accent }}>
        {saving ? '변경 중…' : '공개중'}
      </Text>
    </TouchableOpacity>
  );
}
