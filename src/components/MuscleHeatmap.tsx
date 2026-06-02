import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Ellipse, Rect } from 'react-native-svg';

// ── 색상 ──────────────────────────────────────────────────────────────────────
const COLOR_INACTIVE  = '#CCCCCC';
const COLOR_PRIMARY   = '#FF3B30';
const COLOR_SECONDARY = '#FF7043';
const COLOR_STROKE    = '#BBBBBB';

// ── 근육 그룹 분류 ────────────────────────────────────────────────────────────
const FRONT_MUSCLES = ['CHEST', 'SHOULDER', 'ARMS', 'LEG', 'CORE', 'OTHER'];
const BACK_MUSCLES  = ['BACK', 'GLUTES', 'LEG'];

type Props = {
  activeMuscles: string[];
  size?: number;
};

function getColor(muscle: string, actives: string[]): string {
  if (!actives.includes(muscle)) return COLOR_INACTIVE;
  if (actives.length === 1)      return COLOR_PRIMARY;
  // primary = first active, secondary = rest
  const primaryIdx = actives.indexOf(muscle);
  return primaryIdx === 0 ? COLOR_PRIMARY : COLOR_SECONDARY;
}

// ── Front silhouette — viewBox "0 0 60 160" ──────────────────────────────────

function FrontSilhouette({ actives }: { actives: string[] }) {
  const chestC      = getColor('CHEST',     actives);
  const shoulderC   = getColor('SHOULDER', actives);
  const armsC       = getColor('ARMS',      actives);
  const legsC       = getColor('LEG',      actives);
  const coreC       = actives.includes('CORE') || actives.includes('OTHER')
    ? getColor('CORE', actives.includes('CORE') ? actives : actives.map(a => a === 'OTHER' ? 'CORE' : a))
    : COLOR_INACTIVE;

  return (
    <Svg width="100%" height="100%" viewBox="0 0 60 160">
      {/* Head */}
      <Ellipse cx="30" cy="11" rx="9" ry="10" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="1" />
      {/* Neck */}
      <Rect x="26" y="20" width="8" height="7" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left shoulder */}
      <Path d="M 9,27 L 26,27 L 24,40 L 11,42 Z" fill={shoulderC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right shoulder */}
      <Path d="M 34,27 L 51,27 L 49,42 L 36,40 Z" fill={shoulderC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left chest */}
      <Path d="M 11,42 L 30,40 L 30,60 L 11,60 Z" fill={chestC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right chest */}
      <Path d="M 30,40 L 49,42 L 49,60 L 30,60 Z" fill={chestC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left bicep */}
      <Path d="M 4,27 L 11,27 L 11,62 L 4,62 Z" fill={armsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right bicep */}
      <Path d="M 49,27 L 56,27 L 56,62 L 49,62 Z" fill={armsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left forearm */}
      <Path d="M 4,62 L 11,62 L 12,82 L 3,82 Z" fill={armsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right forearm */}
      <Path d="M 49,62 L 56,62 L 57,82 L 48,82 Z" fill={armsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Core / Abs */}
      <Path d="M 11,60 L 49,60 L 48,80 L 12,80 Z" fill={coreC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Hips */}
      <Path d="M 12,80 L 48,80 L 47,90 L 13,90 Z" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left quad */}
      <Rect x="12" y="90" width="16" height="42" rx="3" fill={legsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right quad */}
      <Rect x="32" y="90" width="16" height="42" rx="3" fill={legsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left calf */}
      <Path d="M 13,132 L 27,132 L 26,155 L 14,155 Z" fill={legsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right calf */}
      <Path d="M 33,132 L 47,132 L 46,155 L 34,155 Z" fill={legsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
    </Svg>
  );
}

// ── Back silhouette — viewBox "0 0 60 160" ───────────────────────────────────

function BackSilhouette({ actives }: { actives: string[] }) {
  const backC    = getColor('BACK',   actives);
  const glutesC  = getColor('GLUTES', actives);
  const legsC    = getColor('LEG',   actives);

  return (
    <Svg width="100%" height="100%" viewBox="0 0 60 160">
      {/* Head */}
      <Ellipse cx="30" cy="11" rx="9" ry="10" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="1" />
      {/* Neck */}
      <Rect x="26" y="20" width="8" height="7" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left shoulder */}
      <Path d="M 9,27 L 26,27 L 24,40 L 11,42 Z" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right shoulder */}
      <Path d="M 34,27 L 51,27 L 49,42 L 36,40 Z" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left lat / trap */}
      <Path d="M 11,42 L 30,38 L 30,78 L 11,80 Z" fill={backC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right lat / trap */}
      <Path d="M 30,38 L 49,42 L 49,80 L 30,78 Z" fill={backC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left arm (back) */}
      <Path d="M 4,27 L 11,27 L 11,82 L 4,82 Z" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right arm (back) */}
      <Path d="M 49,27 L 56,27 L 56,82 L 49,82 Z" fill={COLOR_INACTIVE} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Lower back */}
      <Path d="M 11,80 L 49,80 L 48,90 L 12,90 Z" fill={backC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left glute */}
      <Rect x="12" y="90" width="17" height="20" rx="3" fill={glutesC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right glute */}
      <Rect x="31" y="90" width="17" height="20" rx="3" fill={glutesC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left hamstring */}
      <Rect x="12" y="110" width="17" height="22" rx="2" fill={legsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right hamstring */}
      <Rect x="31" y="110" width="17" height="22" rx="2" fill={legsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Left calf (back) */}
      <Path d="M 13,132 L 28,132 L 27,155 L 14,155 Z" fill={legsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
      {/* Right calf (back) */}
      <Path d="M 32,132 L 47,132 L 46,155 L 33,155 Z" fill={legsC} stroke={COLOR_STROKE} strokeWidth="0.5" />
    </Svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MuscleHeatmap({ activeMuscles, size = 200 }: Props) {
  // Normalize to uppercase
  const actives = activeMuscles.map(m => m.toUpperCase());

  const silhouetteW = Math.round(size * 0.375); // 60/160 aspect ratio
  const totalW      = silhouetteW * 2 + 8;

  return (
    <View style={{ flexDirection: 'row', gap: 8, width: totalW, height: size }}>
      <View style={{ width: silhouetteW, height: size }}>
        <FrontSilhouette actives={actives} />
      </View>
      <View style={{ width: silhouetteW, height: size }}>
        <BackSilhouette actives={actives} />
      </View>
    </View>
  );
}
