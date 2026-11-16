import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';

interface Props {
  nickname:   string;
  avatarUrl?: string;
  /** 본인이 자기 운동일지를 볼 때 안내 문구 */
  note?:      string;
}

// 남의 운동일지 맨 위 — 프로필 사진 + 닉네임 (통계는 넣지 않음)
export default function JournalProfileHeader({ nickname, avatarUrl, note }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.avatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <Ionicons name="person" size={30} color={C.textDim} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.nick} numberOfLines={1}>{nickname}</Text>
        {note ? <Text style={s.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
    backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },
  nick:   { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  note:   { fontSize: 12, color: C.textSub, marginTop: 4, lineHeight: 17 },
});
