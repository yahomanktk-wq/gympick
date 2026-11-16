import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';

type Kind = 'private' | 'blocked' | 'empty' | 'missing';

const COPY: Record<Kind, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string }> = {
  private: { icon: 'lock-closed-outline',  title: '비공개 운동일지예요',        sub: '이 사용자는 운동일지를 공개하지 않았어요.' },
  blocked: { icon: 'ban-outline',          title: '차단한 사용자예요',          sub: '프로필 > 차단한 사용자에서 차단을 풀 수 있어요.' },
  empty:   { icon: 'images-outline',       title: '아직 볼 수 있는 오운완이 없어요', sub: '공개된 오운완이 올라오면 여기에 보여요.' },
  missing: { icon: 'alert-circle-outline', title: '운동일지를 볼 수 없어요',     sub: '탈퇴했거나 잠시 불러오지 못했어요.' },
};

export default function JournalNotice({ kind }: { kind: Kind }) {
  const c = COPY[kind];
  return (
    <View style={s.wrap}>
      <Ionicons name={c.icon} size={40} color={C.textDim} />
      <Text style={s.title}>{c.title}</Text>
      <Text style={s.sub}>{c.sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: C.text, marginTop: 6 },
  sub:   { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 19 },
});
