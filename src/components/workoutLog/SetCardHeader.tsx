// 2026-11-28: 세트 기록 카드 머리 — 머신 사진 + 머신명/브랜드 + 내 PR(두 줄)
// PostWorkoutLogModal의 SetCard에서 분리.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { getMachineImageUrl } from '../../lib/machineImageUrl';

interface Props {
  machineId: string;
  name: string;
  brand: string;
  isFreeWeight: boolean;
  iconColor: { fg: string; bg: string };
  pr?: { weight: number; reps: number };
}

export default function SetCardHeader({ machineId, name, brand, isFreeWeight, iconColor, pr }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = !isFreeWeight && machineId ? getMachineImageUrl(machineId, { width: 128 }) : '';
  const showImage = !!imageUrl && !imgFailed;

  return (
    <View style={s.row}>
      {showImage ? (
        <View style={s.thumb}>
          <Image
            source={{ uri: imageUrl }}
            style={s.thumbImg}
            contentFit="contain"
            cachePolicy="memory-disk"
            onError={() => setImgFailed(true)}
          />
        </View>
      ) : (
        <View style={[s.iconBox, { backgroundColor: iconColor.bg }]}>
          <Ionicons name={isFreeWeight ? 'fitness-outline' : 'barbell'} size={20} color={iconColor.fg} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
        <Text style={s.brand} numberOfLines={1}>{brand}</Text>
      </View>

      {pr && (
        <View style={s.prBox}>
          <Text style={s.prLabel}>내 PR</Text>
          <Text style={s.prVal}>{pr.weight} kg × {pr.reps}</Text>
        </View>
      )}
    </View>
  );
}

const THUMB = 48;

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  thumb:    { width: THUMB, height: THUMB, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  thumbImg: { width: '100%', height: '100%' },
  iconBox:  { width: THUMB, height: THUMB, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name:     { fontSize: 15, fontWeight: '800', color: C.text },
  brand:    { fontSize: 12, color: C.textSub, marginTop: 2 },
  prBox:    { alignItems: 'flex-end', backgroundColor: C.accentBg, borderRadius: R.inner, paddingHorizontal: 10, paddingVertical: 6 },
  prLabel:  { fontSize: 10, fontWeight: '900', color: C.accent, letterSpacing: 0.5 },
  prVal:    { fontSize: 14, fontWeight: '800', color: C.accent, marginTop: 2 },
});
