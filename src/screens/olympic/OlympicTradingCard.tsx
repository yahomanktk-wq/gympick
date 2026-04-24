/**
 * OlympicTradingCard
 * Sports trading card for Machine Olympic battle & result screens.
 * Visual structure matches MachineCard.tsx (9:16, white bg, black border).
 * Wraps in TouchableOpacity with scale animation — entire card is tappable.
 */

import React, { useRef, useState } from 'react';
import {
  TouchableOpacity, Animated, View, Text,
  StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import GymPickLogo from '../../components/GymPickLogo';
import { brandLogos } from '../../constants/brandLogos';
import { getBrandCopyrightStatus } from '../../data/brandCopyrightStore';
import { Machine } from '../../data/types';

const SCREEN_W = Dimensions.get('window').width;
const SUPABASE_STORAGE_URL = 'https://okrouzqqvfioodfieljv.supabase.co/storage/v1/object/public/machine-images';

interface Props {
  machine: Machine;
  width?: number;
  /** Highlight border color when selected */
  selectedColor?: string;
  selected?: boolean;
  /** Called after scale animation completes */
  onPress?: () => void;
  /** If true, card is purely decorative (no press handler) */
  readOnly?: boolean;
}

export default function OlympicTradingCard({
  machine,
  width,
  selectedColor,
  selected = false,
  onPress,
  readOnly = false,
}: Props) {
  const cardW     = width ?? SCREEN_W - 32;
  const cardH     = Math.round(cardW * (16 / 9));
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [imgError, setImgError] = useState(false);

  // Derived layout (scaled relative to card width)
  const scale     = cardW / 220;           // reference width 220px
  const logoW     = Math.max(36, Math.round(52 * scale));
  const nameSize  = Math.max(10, Math.round(16 * scale));
  const bandH     = Math.max(36, Math.round(44 * scale));
  const footerH   = Math.max(26, Math.round(34 * scale));
  const bandBottom = footerH + Math.round(8 * scale);

  const brandKey   = machine.brand.toUpperCase().replace(/\s+/g, '_');
  const brandLogo  = brandLogos[brandKey];
  const approved   = getBrandCopyrightStatus(machine.brand);
  const displayName = machine.displayName ?? machine.name;

  function handlePress() {
    if (!onPress) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 110, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 130, useNativeDriver: true }),
    ]).start(onPress);
  }

  const borderColor = selected && selectedColor ? selectedColor : '#000000';
  const borderWidth = selected ? 3 : 2;

  const cardContent = (
    <Animated.View
      style={[
        cs.card,
        { width: cardW, height: cardH, borderColor, borderWidth },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {/* Background: machine image with Supabase fallback */}
      {!imgError ? (
        <Image
          source={{ uri: machine.imageUrl ?? `${SUPABASE_STORAGE_URL}/${machine.id}.webp` }}
          style={cs.machineImage}
          contentFit="contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={cs.imageBg}>
          <View style={cs.imageFrame}>
            <Ionicons name="barbell-outline" size={Math.round(40 * scale)} color="#CCCCCC" />
          </View>
        </View>
      )}

      {/* Copyright blur overlay */}
      {!approved && (
        <View style={cs.blurOverlay}>
          <Ionicons name="lock-closed" size={Math.round(18 * scale)} color="#FFFFFF" style={{ opacity: 0.9 }} />
          <Text style={[cs.blurText, { fontSize: Math.max(8, Math.round(10 * scale)) }]}>
            {'저작권 보호를 위해\n이미지 사용허가를 요청 중입니다.'}
          </Text>
        </View>
      )}

      {/* Top zone: GymPick logo + machine name */}
      <View style={[cs.topZone, { paddingHorizontal: Math.round(10 * scale), paddingTop: Math.round(10 * scale), gap: Math.round(8 * scale) }]}>
        <View style={{ opacity: 0.85 }}>
          <GymPickLogo color="#000000" width={logoW} />
        </View>
        <Text style={[cs.machineName, { fontSize: nameSize, lineHeight: nameSize * 1.3 }]} numberOfLines={3}>
          {displayName}
        </Text>
      </View>

      {/* Info band */}
      <View style={[cs.infoBand, { bottom: bandBottom, height: bandH, paddingHorizontal: Math.round(10 * scale) }]}>
        {brandLogo ? (
          <Image
            source={brandLogo}
            style={{ width: Math.round(70 * scale), height: Math.round(24 * scale), resizeMode: 'contain' }}
          />
        ) : (
          <Text style={[cs.bandBrandText, { fontSize: Math.max(9, Math.round(12 * scale)) }]} numberOfLines={1}>
            {machine.brand}
          </Text>
        )}
        <View style={[cs.musclePill, { paddingHorizontal: Math.round(6 * scale), paddingVertical: Math.round(3 * scale) }]}>
          <Text style={[cs.muscleText, { fontSize: Math.max(8, Math.round(10 * scale)) }]}>
            {machine.targetMuscle.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[cs.footer, { height: footerH, paddingHorizontal: Math.round(10 * scale) }]}>
        <Text style={[cs.copyright, { fontSize: Math.max(7, Math.round(9 * scale)) }]} numberOfLines={1}>
          {'해당 기구 이미지는 제조사의 저작권 보호를 받습니다.'}
        </Text>
        <View style={{ opacity: 0.85 }}>
          <GymPickLogo color="#000000" width={Math.max(28, Math.round(40 * scale))} />
        </View>
      </View>

      {/* Selected glow overlay */}
      {selected && selectedColor && (
        <View style={[cs.selectedOverlay, { borderColor: selectedColor, borderWidth: 3 }]} />
      )}
    </Animated.View>
  );

  if (readOnly) return cardContent;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      {cardContent}
    </TouchableOpacity>
  );
}

const cs = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000000',
    shadowOpacity:   0.12,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       5,
  },
  machineImage: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
  },
  imageBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  imageFrame: {
    width: '72%', aspectRatio: 1,
    borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  imageBgLabel: { fontWeight: '700', color: '#CCCCCC', letterSpacing: 2 },

  blurOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 12,
  },
  blurText: { fontWeight: '600', color: '#FFFFFF', textAlign: 'center', lineHeight: 16, opacity: 0.92 },

  topZone: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'column', alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', paddingBottom: 10,
  },
  machineName: {
    alignSelf: 'stretch', fontWeight: '900', color: '#000000',
    textAlign: 'center', letterSpacing: 0.5,
  },

  infoBand: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(45,45,55,0.88)',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#000000',
  },
  bandBrandText: { fontWeight: '700', color: '#FFFFFF', flexShrink: 1, marginRight: 4 },
  musclePill: {
    backgroundColor: '#7CFF3B', borderRadius: 100,
  },
  muscleText: { fontWeight: '800', color: '#000000', letterSpacing: 0.5 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#000000',
  },
  copyright: { flex: 1, fontWeight: '500', color: '#888888', marginRight: 6 },

  selectedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16, backgroundColor: 'transparent',
  },
});
