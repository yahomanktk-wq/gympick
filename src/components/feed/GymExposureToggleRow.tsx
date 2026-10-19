import React from 'react';
import { View, Text, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';

// 오운완 업로드(사진) 화면의 '헬스장 페이지에 공개' 토글 (F1-5).
// 오운완 피드 공개(is_public)와는 별개로, 헬스장 상세/우리 헬스장 탭 노출(show_on_gym)만 제어한다.

interface Props {
  gymName:    string;
  value:      boolean;
  onChange:   (v: boolean) => void;
  showNotice: boolean;
}

export default function GymExposureToggleRow({ gymName, value, onChange, showNotice }: Props) {
  return (
    <View style={{
      backgroundColor: C.surface, borderRadius: R.card,
      borderWidth: 1, borderColor: C.border,
      padding: 16, marginTop: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>헬스장 페이지에 공개</Text>
          <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
            {value
              ? `${gymName} 상세 페이지에 이 오운완이 보여요`
              : '헬스장 페이지에는 보이지 않아요 (오운완 피드는 그대로)'}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={v => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(v);
          }}
          thumbColor={value ? C.accent : C.textDim}
          trackColor={{ false: C.border, true: C.accentBg }}
        />
      </View>

      {showNotice && (
        <View style={{ backgroundColor: C.accentBg, borderRadius: R.inner, padding: 10, marginTop: 12 }}>
          <Text style={{ fontSize: 12, color: C.text, lineHeight: 18 }}>
            처음 올리는 오운완이네요! 오운완은 운동한 헬스장 페이지에도 보여요. 원하지 않으면 여기서 끌 수 있어요.
          </Text>
        </View>
      )}
    </View>
  );
}
