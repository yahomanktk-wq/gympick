import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { fetchMyAttachableOunwan } from '../../../lib/db/gymQna';

// 2026-11-09: Q&A 질문에 내 오운완(그날 운동 루틴 포함) 하나 붙이기. 나만 보기 글은 후보에서 뺀다.

interface Props {
  userId:   string;
  value:    string | null;
  onChange: (postId: string | null) => void;
}

export default function AttachOunwanPicker({ userId, value, onChange }: Props) {
  const [items, setItems] = useState<{ id: string; uri: string; gymName: string; createdAt: string }[]>([]);

  useEffect(() => {
    fetchMyAttachableOunwan(userId).then(setItems);
  }, [userId]);

  if (items.length === 0) {
    return <Text style={s.empty}>붙일 수 있는 오운완이 없어요 (나만 보기 글은 제외)</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {items.map(it => {
        const selected = value === it.id;
        const d = new Date(it.createdAt);
        return (
          <TouchableOpacity key={it.id} onPress={() => onChange(selected ? null : it.id)} activeOpacity={0.85}>
            <View style={[s.thumbWrap, selected && s.thumbSelected]}>
              <Image source={{ uri: it.uri }} style={s.thumb} contentFit="cover" />
              {selected && (
                <View style={s.check}><Ionicons name="checkmark" size={14} color={C.bg} /></View>
              )}
            </View>
            <Text style={s.date}>{d.getMonth() + 1}/{d.getDate()}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  empty:         { color: C.textSub, fontSize: 12 },
  thumbWrap:     { width: 72, height: 96, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbSelected: { borderColor: C.accent },
  thumb:         { width: '100%', height: '100%' },
  check:         { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  date:          { color: C.textSub, fontSize: 11, textAlign: 'center', marginTop: 3 },
});
