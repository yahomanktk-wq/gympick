import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';

// 오운완 피드 '주변 5km' 탭 — 위치 권한이 없을 때 보여주는 안내 + 허용 버튼 (F2-4).
// 시각적 무게는 WorkoutFeedScreen의 EmptyState와 맞춘다.

interface Props {
  onPress: () => void;
}

export default function LocationPermissionPrompt({ onPress }: Props) {
  return (
    <View style={{
      flex: 1, alignItems: 'center', justifyContent: 'center',
      gap: 12, paddingBottom: 60,
    }}>
      <Ionicons name="location-outline" size={44} color={C.textDim} />
      <Text style={{ fontSize: 14, color: C.textDim, fontWeight: '500' }}>
        위치 권한이 없어 주변 오운완을 볼 수 없어요
      </Text>
      <TouchableOpacity
        style={{
          paddingHorizontal: 16, paddingVertical: 10,
          borderRadius: R.pill, backgroundColor: C.accent,
          marginTop: 14,
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.85}
      >
        <Text style={{ color: C.bg, fontWeight: '700', fontSize: 13 }}>위치 권한 허용하기</Text>
      </TouchableOpacity>
    </View>
  );
}
