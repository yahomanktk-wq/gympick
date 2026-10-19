import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';

// 오운완 업로드(운동 사진) 화면 하단 안내 한 줄 (2026-10-20).
// 공개 여부 토글을 없애고 기본 공개로 바꾸면서, 어디에 보이는지와
// 비공개로 바꾸는 방법만 짧게 알려준다.

export default function OunwanVisibilityNote() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingHorizontal: 4 }}>
      <Ionicons name="information-circle-outline" size={14} color={C.textSub} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: C.textSub }}>
        오운완은 오늘의 오운완과 헬스장 페이지에 공개돼요. 운동일지에서 비공개로 바꿀 수 있어요.
      </Text>
    </View>
  );
}
