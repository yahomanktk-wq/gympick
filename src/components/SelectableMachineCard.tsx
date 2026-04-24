import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import GymPickLogo from './GymPickLogo';
import { brandLogos } from '../constants/brandLogos';
import { getBrandCopyrightStatus } from '../data/brandCopyrightStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectableMachineCardMachine {
  id:           string;
  name:         string;
  displayName?: string;
  brand:        string;
  targetMuscle: string;
  category:     string;
  copyright?:   string;
}

interface Props {
  machine:   SelectableMachineCardMachine;
  width:     number;
  selected:  boolean;
  completed: boolean; // Path A — already logged
  onSelect:  () => void;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const BAND_H      = 52;
const FOOTER_H    = 56;
const BAND_BOTTOM = FOOTER_H + 10;
const LOGO_SIZE   = 64;

const COPYRIGHT_KO = '해당 기구 이미지는 제조사의 저작권 보호를 받으며, 본 페이지는 정보 제공 목적입니다.';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SelectableMachineCard({ machine, width, selected, completed, onSelect }: Props) {
  const cardH         = Math.round(width * (16 / 9));
  const brandKey      = machine.brand.toUpperCase().replace(/\s+/g, '_');
  const brandLogo     = brandLogos[brandKey];
  const imageApproved = getBrandCopyrightStatus(machine.brand);

  const borderColor  = completed
    ? C.accent + '80'
    : selected
      ? C.accent
      : '#000000';
  const borderWidth  = selected || completed ? 3 : 2;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onSelect}
      style={[s.card, { width, height: cardH, borderColor, borderWidth }]}
    >
      {/* Background */}
      <View style={s.imageBg}>
        <View style={s.imageFrame}>
          <Ionicons name="image-outline" size={52} color="#CCCCCC" />
          <Text style={s.imageBgLabel}>NO IMAGE</Text>
        </View>
      </View>

      {/* Copyright blur overlay */}
      {!imageApproved && (
        <View style={s.blurOverlay}>
          <Ionicons name="lock-closed" size={28} color="#FFFFFF" style={{ opacity: 0.9 }} />
          <Text style={s.blurText}>{'저작권 보호를 위해\n이미지 사용허가를 요청 중입니다.'}</Text>
        </View>
      )}

      {/* Top zone */}
      <View style={s.topZone}>
        <View style={{ opacity: 0.85 }}>
          <GymPickLogo color="#000000" width={LOGO_SIZE} />
        </View>
        <Text style={s.machineName} numberOfLines={2}>
          {machine.displayName ?? machine.name}
        </Text>
      </View>

      {/* Info band */}
      <View style={[s.infoBand, { bottom: BAND_BOTTOM, height: BAND_H }]}>
        {brandLogo ? (
          <View style={s.brandBox}>
            <Image source={brandLogo} style={s.brandLogo} />
          </View>
        ) : (
          <Text style={s.bandValue} numberOfLines={1}>{machine.brand}</Text>
        )}
        <View style={s.musclePill}>
          <Text style={s.muscleText}>{machine.targetMuscle.toUpperCase()}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[s.footer, { height: FOOTER_H }]}>
        <Text style={s.copyright}>{COPYRIGHT_KO}</Text>
        <View style={{ opacity: 0.85 }}>
          <GymPickLogo color="#000000" width={LOGO_SIZE} />
        </View>
      </View>

      {/* Selected checkmark overlay */}
      {selected && !completed && (
        <View style={s.checkOverlay}>
          <View style={s.checkCircle}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        </View>
      )}

      {/* Completed badge */}
      {completed && (
        <View style={s.completedOverlay}>
          <View style={s.completedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={C.accent} />
            <Text style={s.completedText}>완료</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000000',
    shadowOpacity:   0.08,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       4,
  },
  imageBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  imageFrame: {
    width: '80%', aspectRatio: 1,
    borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  imageBgLabel: { fontSize: 11, fontWeight: '700', color: '#CCCCCC', letterSpacing: 2 },

  blurOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16,
  },
  blurText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: 24, opacity: 0.92 },

  topZone: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'column', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 12,
    backgroundColor: '#FFFFFF',
  },
  machineName: {
    alignSelf: 'stretch', fontSize: 22, fontWeight: '900', color: '#000000',
    textAlign: 'center', letterSpacing: 1, lineHeight: 29,
  },

  infoBand: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: 'rgba(80,80,95,0.90)',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#000000',
  },
  bandValue:  { fontSize: 14, fontWeight: '700', color: '#FFFFFF', flexShrink: 1, marginRight: 8 },
  brandBox:   { width: 140, height: 48, justifyContent: 'center' },
  brandLogo:  { maxWidth: 120, maxHeight: 40, width: 120, height: 40, resizeMode: 'contain' },
  musclePill: { backgroundColor: '#7CFF3B', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 },
  muscleText: { fontSize: 13, fontWeight: '800', color: '#000000', letterSpacing: 1 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#000000',
  },
  copyright: {
    flex: 1, fontSize: 9, fontWeight: '500', color: '#666666',
    letterSpacing: 0.2, marginRight: 8, flexWrap: 'wrap', flexShrink: 1,
  },

  // Selected state
  checkOverlay: { position: 'absolute', top: 8, right: 8 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },

  // Completed state
  completedOverlay: { position: 'absolute', top: 8, right: 8 },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: R.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  completedText: { fontSize: 11, fontWeight: '700', color: C.accent },
});
