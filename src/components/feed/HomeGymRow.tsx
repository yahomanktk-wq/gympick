import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';

// 오운완 피드 '내 헬스장' 탭 상단의 홈짐 이름 한 줄 (F2-2).
// F2-3에서 이 줄에 '변경' 버튼이 추가될 예정이라 별도 컴포넌트로 둔다.

interface Props {
  gymName: string;
  onPressChange?: () => void;   // 로그인 유저만 전달 → '변경' 버튼 표시 (F2-3)
}

export default function HomeGymRow({ gymName, onPressChange }: Props) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 16, paddingBottom: 8,
    }}>
      <Ionicons name="location-outline" size={13} color={C.textSub} />
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: C.text }} numberOfLines={1}>
        {gymName}
      </Text>
      {onPressChange && (
        <TouchableOpacity onPress={onPressChange} hitSlop={8} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: C.accent }}>변경</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
