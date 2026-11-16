import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';
import { fetchMyJournalPrivate, setMyJournalPrivate } from '../../lib/db/userJournal';

// 2026-11-16: 프로필 > 운동일지 비공개 스위치.
// 켜면 내 운동일지뿐 아니라 오운완도 피드·헬스장 커뮤니티·공유 링크에서 다른 사람에게 보이지 않는다.
// (게시물 공개 범위는 그대로 두고, 끄면 원래 공개 범위대로 다시 보인다)

export default function JournalPrivacyToggle({ userId }: { userId: string }) {
  const [on,     setOn]     = useState(false);
  const [ready,  setReady]  = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMyJournalPrivate(userId).then(v => { if (alive) { setOn(v); setReady(true); } });
    return () => { alive = false; };
  }, [userId]);

  async function apply(next: boolean) {
    setSaving(true);
    setOn(next);
    const ok = await setMyJournalPrivate(userId, next);
    setSaving(false);
    if (!ok) {
      setOn(!next);
      Alert.alert('변경하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  }

  function onChange(next: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!next) { apply(false); return; }
    Alert.alert(
      '운동일지를 비공개로 할까요?',
      '다른 사람이 내 운동일지를 볼 수 없고, 내 오운완도 피드·헬스장 커뮤니티에서 보이지 않아요. 끄면 원래대로 다시 보여요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '비공개로 하기', onPress: () => apply(true) },
      ],
    );
  }

  return (
    <View style={s.row}>
      <View style={s.icon}>
        <Ionicons name={on ? 'lock-closed-outline' : 'lock-open-outline'} size={16} color={C.textSub} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>운동일지 비공개</Text>
        <Text style={s.sub}>{on ? '나만 볼 수 있어요 (오운완 포함)' : '닉네임을 누르면 다른 사람도 볼 수 있어요'}</Text>
      </View>
      <Switch
        value={on}
        disabled={!ready || saving}
        onValueChange={onChange}
        thumbColor={on ? C.accent : C.textDim}
        trackColor={{ false: C.border, true: C.accentBg }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  icon:  { width: 34, height: 34, borderRadius: 9, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, color: C.text, fontWeight: '500' },
  sub:   { fontSize: 12, color: C.textSub, marginTop: 2 },
});
