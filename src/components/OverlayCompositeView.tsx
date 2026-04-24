import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import GymPickLogo from './GymPickLogo';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  photoUri:       string;
  compositeRef:   React.RefObject<View | null>;
  nickname?:      string;
  gymName?:       string;
  formattedDate?: string;       // 예: '2026.04.14 · 오전 10:30'
  targetMuscles?: string[];     // 예: ['CHEST', 'BACK']
  machines?:      string[];     // 머신명 배열 예: ['Chest Press', 'Lat Pulldown']
  overlayColor?:  string;       // 색상 팔레트 선택값
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function OverlayCompositeView({
  photoUri,
  compositeRef,
  nickname,
  gymName,
  formattedDate,
  targetMuscles,
  machines,
  overlayColor,
}: Props) {
  return (
    <View ref={compositeRef} collapsable={false} style={s.container}>

      {/* 1. 배경: 원본 사진 */}
      <Image
        source={{ uri: photoUri }}
        style={s.photo}
        contentFit="cover"
      />

      {/* 2. 상단 오버레이: GymPick 로고 + 닉네임 */}
      <View style={s.topOverlay}>
        <GymPickLogo color="#FFFFFF" width={72} />
        {nickname && (
          <Text style={s.nicknameText}>@{nickname}</Text>
        )}
      </View>

      {/* 3. 하단 오버레이: 반투명 배경 위에 정보 */}
      <View style={s.bottomOverlay}>

        {/* 타겟 부위 배지들 */}
        {targetMuscles && targetMuscles.length > 0 && (
          <View style={s.muscleRow}>
            {targetMuscles.map((m, i) => (
              <View key={i} style={[s.muscleBadge, { backgroundColor: overlayColor ?? '#7CFF3B' }]}>
                <Text style={s.muscleBadgeText}>{m}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 일시 */}
        {formattedDate && (
          <Text style={s.dateText}>{formattedDate}</Text>
        )}

        {/* 헬스장명 */}
        {gymName && (
          <Text style={s.gymText}>{gymName}</Text>
        )}

        {/* 운동 루틴 (머신 목록, 최대 5개) */}
        {machines && machines.length > 0 && (
          <View style={s.machineList}>
            {machines.slice(0, 5).map((m, i) => (
              <Text key={i} style={s.machineItem} numberOfLines={1}>· {m}</Text>
            ))}
            {machines.length > 5 && (
              <Text style={s.machineItem}>· 외 {machines.length - 5}개</Text>
            )}
          </View>
        )}

      </View>

      {/* 4. 테두리 */}
      <View
        style={[s.border, { borderColor: overlayColor ?? 'rgba(255,255,255,0.4)' }]}
        pointerEvents="none"
      />

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    width:           '100%',
    aspectRatio:     3 / 4,
    position:        'relative',
    backgroundColor: '#000',
  },
  photo: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  topOverlay: {
    position:       'absolute',
    top:            14,
    left:           14,
    right:          14,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  nicknameText: {
    color:            '#FFFFFF',
    fontSize:         13,
    fontWeight:       '700',
    textShadowColor:  'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomOverlay: {
    position:         'absolute',
    bottom:           0,
    left:             0,
    right:            0,
    paddingHorizontal: 14,
    paddingVertical:  14,
    paddingBottom:    18,
    backgroundColor:  'rgba(0,0,0,0.52)',
    gap:              5,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           5,
    marginBottom:  4,
  },
  muscleBadge: {
    borderRadius:      4,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  muscleBadgeText: {
    fontSize:      10,
    fontWeight:    '800',
    color:         '#000000',
    letterSpacing: 0.8,
  },
  dateText: {
    color:      'rgba(255,255,255,0.75)',
    fontSize:   11,
    fontWeight: '500',
  },
  gymText: {
    color:      '#FFFFFF',
    fontSize:   13,
    fontWeight: '700',
  },
  machineList: {
    marginTop: 3,
    gap:       2,
  },
  machineItem: {
    color:      'rgba(255,255,255,0.85)',
    fontSize:   11,
    fontWeight: '500',
  },
  border: {
    position:     'absolute',
    top:          0,
    left:         0,
    right:        0,
    bottom:       0,
    borderWidth:  3,
    borderRadius: 2,
  },
});
