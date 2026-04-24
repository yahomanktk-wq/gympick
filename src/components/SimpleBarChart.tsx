import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, T } from '../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  data:          { label: string; value: number }[];
  color?:        string;
  height?:       number;
  unit?:         string;
  emptyMessage?: string;
};

// ── Sub-components (module-level) ─────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{message}</Text>
    </View>
  );
}

function Bar({
  value,
  label,
  ratio,
  color,
  unit,
  chartHeight,
}: {
  value:       number;
  label:       string;
  ratio:       number;
  color:       string;
  unit:        string;
  chartHeight: number;
}) {
  const barH = Math.max(4, Math.round(ratio * (chartHeight - 40)));
  return (
    <View style={s.barCol}>
      <Text style={s.barValue} numberOfLines={1}>
        {value > 0 ? `${value}${unit}` : ''}
      </Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { height: barH, backgroundColor: color }]} />
      </View>
      <Text style={s.barLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SimpleBarChart({
  data,
  color        = C.accent,
  height       = 140,
  unit         = '',
  emptyMessage = '데이터가 없습니다.',
}: Props) {
  if (!data.length) {
    return <EmptyState message={emptyMessage} />;
  }

  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <View style={[s.container, { height }]}>
      {data.map(item => (
        <Bar
          key={item.label}
          value={item.value}
          label={item.label}
          ratio={item.value / maxVal}
          color={color}
          unit={unit}
          chartHeight={height}
        />
      ))}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    gap:            4,
    paddingBottom:  20,
  },
  barCol: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontSize:   9,
    color:      C.textSub,
    fontWeight: '700',
    marginBottom: 3,
    textAlign:  'center',
  },
  barTrack: {
    width:          '80%',
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  barFill: {
    width:        '100%',
    borderRadius: 3,
    minHeight:    4,
  },
  barLabel: {
    marginTop: 4,
    fontSize:  9,
    color:     C.textSub,
    textAlign: 'center',
  },
  empty: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    ...T.label,
    color:     C.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
});
