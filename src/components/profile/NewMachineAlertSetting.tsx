import React, { useState, useEffect } from 'react';
import { View, Text, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';
import { fetchNotifyNewMachine, setNotifyNewMachine } from '../../lib/db/userProfiles';

// 2026-10-19 (F4-3): 프로필 '새 머신 입고 알림' 설정 (profiles.notify_new_machine, 기본 켜짐).
// 끄면 DB 트리거(trg_notify_new_gym_machine)가 이 유저에게 알림을 만들지 않는다.

interface Props {
  userId: string;
}

export default function NewMachineAlertSetting({ userId }: Props) {
  const [on,     setOn]     = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    fetchNotifyNewMachine(userId).then(value => {
      if (!alive) return;
      setOn(value);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [userId]);

  async function handleChange(next: boolean) {
    const prev = on;
    setOn(next);   // 낙관적 업데이트
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await setNotifyNewMachine(userId, next);
    } catch {
      setOn(prev);
      Alert.alert('오류', '설정 변경에 실패했어요.');
    }
  }

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: R.card,
      borderWidth: 1, borderColor: C.border,
      padding: 14,
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 9,
        backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="barbell-outline" size={16} color={C.textSub} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, color: C.text }}>새 머신 입고 알림</Text>
        <Text style={{ fontSize: 11, color: C.textSub }}>
          즐겨찾기한 머신이 우리 동네 헬스장에 들어오면 알려드려요
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={handleChange}
        disabled={!loaded}
        thumbColor={on ? C.accent : C.textDim}
        trackColor={{ false: C.border, true: C.accentBg }}
      />
    </View>
  );
}
