import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WorkoutBadge as WorkoutBadgeType } from '../data/types';

type Props = {
  badge: WorkoutBadgeType;
  size?: 'small' | 'large';
};

// ── Sub-components (module-level) ─────────────────────────────────────────────

function BadgeCircle({
  color,
  diameter,
  emoji,
  emojiSize,
  label,
  fontSize,
}: {
  color:      string;
  diameter:   number;
  emoji:      string;
  emojiSize:  number;
  label:      string;
  fontSize:   number;
}) {
  return (
    <View style={[s.circle, { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: color }]}>
      <Text style={{ fontSize: emojiSize, lineHeight: emojiSize + 4 }}>{emoji}</Text>
      <Text style={[s.label, { fontSize }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WorkoutBadge({ badge, size = 'small' }: Props) {
  const isSmall  = size === 'small';
  const diameter = isSmall ? 56 : 80;
  const emojiSize = isSmall ? 20 : 28;
  const fontSize  = isSmall ? 9  : 11;

  if (badge.type === 'streak') {
    const label = isSmall ? badge.label : `${badge.label}\n운동 달성!`;
    return (
      <BadgeCircle
        color="#FF6B35"
        diameter={diameter}
        emoji="🔥"
        emojiSize={emojiSize}
        label={label}
        fontSize={fontSize}
      />
    );
  }

  // pr
  const label = isSmall
    ? 'PR 달성'
    : `PR 달성!\n${badge.machineName ?? ''}`;
  return (
    <BadgeCircle
      color="#FFB300"
      diameter={diameter}
      emoji="🏆"
      emojiSize={emojiSize}
      label={label}
      fontSize={fontSize}
    />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  circle: {
    alignItems:      'center',
    justifyContent:  'center',
    padding:         4,
    gap:             2,
  },
  label: {
    color:      '#FFFFFF',
    fontWeight: '700',
    textAlign:  'center',
    lineHeight: 13,
  },
});
