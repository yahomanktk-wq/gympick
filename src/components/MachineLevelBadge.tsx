import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getLevelColor } from '../lib/machineLevelUtils';

type Props = {
  level: number;
  size?: 'small' | 'medium';
};

// 육각형 path (pointy-top)
function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M ${pts[0]} L ${pts[1]} L ${pts[2]} L ${pts[3]} L ${pts[4]} L ${pts[5]} Z`;
}

export default function MachineLevelBadge({ level, size = 'small' }: Props) {
  if (!level || level <= 0) return null;

  const dim      = size === 'medium' ? 36 : 28;
  const cx       = dim / 2;
  const cy       = dim / 2;
  const r        = dim / 2 - 2;
  const color    = getLevelColor(level);
  const fontSize = size === 'medium' ? 9 : 7;

  return (
    <View style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={dim} height={dim} style={StyleSheet.absoluteFillObject}>
        <Path d={hexPath(cx, cy, r)} fill={color} stroke="#000" strokeWidth={1} />
      </Svg>
      <Text style={[s.label, { fontSize, lineHeight: fontSize + 2 }]} numberOfLines={1}>
        {`Lv.${level}`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    color:      '#FFFFFF',
    fontWeight: '800',
    textAlign:  'center',
    letterSpacing: -0.5,
  },
});
