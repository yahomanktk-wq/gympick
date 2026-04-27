import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import GymPickLogo from './GymPickLogo';
import { brandLogos } from '../constants/brandLogos';
import { getBrandCopyrightStatus } from '../data/brandCopyrightStore';

export interface MachineCardMachine {
  id:           string;
  name:         string;
  displayName?: string;
  brand:        string;
  targetMuscle: string;
  category:     string;
  copyright?:   string;
  imageUrl?:    string;
}

interface Props {
  machine: MachineCardMachine;
  width?: number;
  variant?: 'grid' | 'detail';
}

const SCREEN_W    = Dimensions.get('window').width;
const DEFAULT_W   = SCREEN_W - 32;
const GRID_GAP    = 8;
const GRID_W      = (SCREEN_W - 32 - GRID_GAP) / 2;

const BAND_H        = 62;
const FOOTER_H      = 64;
const FOOTER_H_GRID = 36;
const LOGO_SIZE     = 88;

const BORDER_INSET  = 8;
const BORDER_STROKE = 1.6;

// 로고 위치: 테두리 안쪽 + 여백
// 상단좌측 로고: top/left = LOGO_MARGIN
// 하단우측 로고: bottom/right = LOGO_MARGIN (완전 대칭)
const LOGO_MARGIN   = BORDER_INSET + 6;  // 14px

const INNER_PAD_H   = BORDER_INSET + 8;
const INNER_PAD_V   = BORDER_INSET + 8;
const INNER_PAD_BOT = BORDER_INSET + 8;
const GRID_PAD_H    = BORDER_INSET + 4;
const GRID_PAD_V    = BORDER_INSET + 2;

export default function MachineCard({ machine, width, variant = 'detail' }: Props) {
  const isGrid  = variant === 'grid';
  const cardW   = width ?? (isGrid ? GRID_W : DEFAULT_W);
  const cardH   = Math.round(cardW * (16 / 9));
  const logoW   = isGrid ? 36 : LOGO_SIZE;

  const COPYRIGHT_KO = '해당 기구 이미지는 제조사의 저작권 보호를 받으며, 본 페이지는 정보 제공 목적입니다.';
  const brandKey     = machine.brand.toUpperCase().replace(/\s+/g, '_');
  const brandLogo    = brandLogos[brandKey];
  const imageApproved = getBrandCopyrightStatus(machine.brand);
  const resolvedImageUrl = machine.imageUrl ?? `https://okrouzqqvfioodfieljv.supabase.co/storage/v1/object/public/machine-images/${machine.id}.webp`;

  const padH    = isGrid ? GRID_PAD_H     : INNER_PAD_H;
  const padV    = isGrid ? GRID_PAD_V     : INNER_PAD_V;
  const padBot  = isGrid ? GRID_PAD_V + 2 : INNER_PAD_BOT;
  const bandH   = isGrid ? 38             : BAND_H;
  const footerH = isGrid ? FOOTER_H_GRID  : FOOTER_H;

  // infoBand는 footer 바로 위에 위치
  const bandBottom = footerH + BORDER_INSET;

  // 상단 topZone 높이: 로고 + 머신명 구역
  // topZone 아래쪽 padding 포함
  const topZonePadTop = padV;
  const topZonePadBot = isGrid ? 6 : 10;
  const logoH         = isGrid ? 14 : Math.round(LOGO_SIZE / (2805 / 279)); // SVG 비율 약 10:1

  return (
    <View style={[s.card, { width: cardW, height: cardH }]}>

      {/* ── Background image ─────── */}
      <View style={s.imageBg}>
        <Image
          source={{ uri: resolvedImageUrl }}
          style={{ width: '100%', height: '100%', backgroundColor: '#FFFFFF' }}
          contentFit="contain"
        />
      </View>

      {/* ── Copyright blur overlay ──── */}
      {!imageApproved && (
        <View style={s.blurOverlay}>
          <Ionicons name="lock-closed" size={isGrid ? 16 : 34} color="#FFFFFF" style={{ opacity: 0.9 }} />
          <Text style={[s.blurText, isGrid && { fontSize: 11, lineHeight: 16 }]}>
            {'저작권 보호를 위해\n이미지 사용허가를\n요청 중입니다.'}
          </Text>
        </View>
      )}

      {/* ── Top zone: 머신명만 (로고는 absolute로 분리) ── */}
      <View style={[s.topZone, {
        paddingHorizontal: padH,
        paddingTop:        padV + logoH + 8,  // 로고 높이 + 간격만큼 아래로
        paddingBottom:     topZonePadBot,
        gap:               isGrid ? 4 : 12,
      }]}>
        <View style={[s.machineNameZone, isGrid && s.machineNameZoneGrid]}>
          <Text
            style={[s.machineName, isGrid && s.machineNameGrid]}
            numberOfLines={2}
            textBreakStrategy="balanced"
          >
            {machine.displayName ?? machine.name}
          </Text>
        </View>
      </View>

      {/* ── Info band ── */}
      <View style={[s.infoBand, {
        bottom:            bandBottom,
        height:            bandH,
        left:              BORDER_INSET,
        right:             BORDER_INSET,
        borderRadius:      0,
        paddingHorizontal: isGrid ? 8 : 12,
      }]}>
        {brandLogo ? (
          <View style={[s.brandBox, isGrid && { width: 64, height: 24 }]}>
            <Image
              source={brandLogo}
              style={[s.brandLogo, isGrid && { maxWidth: 54, maxHeight: 18, width: 54, height: 18 }]}
            />
          </View>
        ) : (
          <Text style={[s.bandValue, isGrid && { fontSize: 10 }]} numberOfLines={1}>{machine.brand}</Text>
        )}
        <View style={[s.musclePill, isGrid && { paddingHorizontal: 6, paddingVertical: 3 }]}>
          <Text style={[s.muscleText, isGrid && { fontSize: 9, letterSpacing: 0.5 }]}>
            {machine.targetMuscle.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── Footer: 저작권만 (로고는 absolute로 분리) ── */}
      <View style={[s.footer, {
        minHeight:         footerH,
        paddingHorizontal: padH,
        paddingBottom:     padBot,
        paddingTop:        8,
        left:              BORDER_INSET,
        right:             BORDER_INSET,
        bottom:            BORDER_INSET,
        borderRadius:      0,
        // 우측 하단 로고 공간 확보
        paddingRight:      logoW + 8,
      }]}>
        <Text
          style={[s.copyright, isGrid && { fontSize: 7, lineHeight: 10 }]}
          numberOfLines={isGrid ? 2 : undefined}
        >
          {isGrid ? '© 제조사 저작권 보호' : COPYRIGHT_KO}
        </Text>
      </View>

      {/* ── 상단 좌측 GymPick 로고 (absolute) ── */}
      <View
        style={{
          position: 'absolute',
          top:      LOGO_MARGIN,
          left:     LOGO_MARGIN,
          opacity:  0.85,
          zIndex:   10,
        }}
        pointerEvents="none"
      >
        <GymPickLogo color="#000000" width={logoW} />
      </View>

      {/* ── 하단 우측 GymPick 로고 (absolute, 대칭) ── */}
      <View
        style={{
          position: 'absolute',
          bottom:   LOGO_MARGIN,
          right:    LOGO_MARGIN,
          opacity:  0.85,
          zIndex:   10,
        }}
        pointerEvents="none"
      >
        <GymPickLogo color="#000000" width={logoW} />
      </View>

      {/* ── SVG 테두리: 상하좌우 8px 안쪽 ── */}
      <Svg
        style={{ position: 'absolute', top: 0, left: 0 }}
        width={cardW}
        height={cardH}
        pointerEvents="none"
      >
        <Rect
          x={BORDER_INSET}
          y={BORDER_INSET}
          width={cardW - BORDER_INSET * 2}
          height={cardH - BORDER_INSET * 2}
          rx={12}
          ry={12}
          fill="none"
          stroke="#000000"
          strokeWidth={BORDER_STROKE}
        />
      </Svg>

    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000000',
    shadowOpacity:   0.20,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 3 },
    elevation:       6,
  },
  imageBg: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#FFFFFF',
  },
  blurOverlay: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    bottom:            0,
    backgroundColor:   'rgba(0, 0, 0, 0.62)',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               10,
    paddingHorizontal: 16,
  },
  blurText: {
    fontSize:   20,
    fontWeight: '800',
    color:      '#FFFFFF',
    textAlign:  'center',
    lineHeight: 30,
    opacity:    0.92,
  },
  topZone: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    flexDirection:   'column',
    alignItems:      'flex-start',
    backgroundColor: 'transparent',
  },
  machineNameZone: {
    alignSelf:         'stretch',
    alignItems:        'center',
    justifyContent:    'center',
    height:            80,
    paddingHorizontal: 4,
  },
  machineNameZoneGrid: {
    height:            52,
    paddingHorizontal: 2,
  },
  machineName: {
    alignSelf:     'stretch',
    fontSize:      26,
    fontWeight:    '900',
    color:         '#000000',
    textAlign:     'center',
    letterSpacing: 0.5,
    lineHeight:    28,
  },
  machineNameGrid: {
    fontSize:   16,
    lineHeight: 18,
  },
  infoBand: {
    position:        'absolute',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: 'rgba(100,100,120,0.88)',
  },
  bandValue: {
    fontSize:    14,
    fontWeight:  '700',
    color:       '#FFFFFF',
    flexShrink:  1,
    marginRight: 8,
  },
  brandBox: {
    width:          150,
    height:         54,
    justifyContent: 'center',
  },
  brandLogo: {
    maxWidth:   130,
    maxHeight:  46,
    width:      130,
    height:     46,
    resizeMode: 'contain',
  },
  musclePill: {
    backgroundColor:   '#7CFF3B',
    borderRadius:      R.pill,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  muscleText: {
    fontSize:      13,
    fontWeight:    '800',
    color:         '#000000',
    letterSpacing: 1,
  },
  footer: {
    position:        'absolute',
    flexDirection:   'row',
    alignItems:      'flex-end',
    justifyContent:  'flex-start',
    backgroundColor: '#FFFFFF',
  },
  copyright: {
    flex:          1,
    fontSize:      9,
    fontWeight:    '500',
    color:         '#666666',
    letterSpacing: 0.2,
    marginRight:   8,
    flexWrap:      'wrap',
    flexShrink:    1,
    lineHeight:    14,
  },
});
