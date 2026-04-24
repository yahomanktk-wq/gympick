import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText } from 'react-native-svg';
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

function XLabels({ labels, width }: { labels: string[]; width: number }) {
  const n    = labels.length;
  const step = n > 1 ? width / (n - 1) : width / 2;
  return (
    <View style={[s.xLabels, { width }]}>
      {labels.map((label, i) => (
        <Text
          key={`${label}-${i}`}
          style={[
            s.xLabel,
            {
              position: 'absolute',
              left:     n > 1 ? i * step - 16 : width / 2 - 16,
              width:    32,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SimpleLineChart({
  data,
  color        = C.accent,
  height       = 140,
  unit         = '',
  emptyMessage = '데이터가 부족합니다.',
}: Props) {
  if (data.length <= 1) {
    return <EmptyState message={emptyMessage} />;
  }

  const SVG_W    = 300;
  const SVG_H    = height - 24; // leave room for x labels
  const PAD_L    = 36;
  const PAD_R    = 12;
  const PAD_T    = 16;
  const PAD_B    = 12;
  const plotW    = SVG_W - PAD_L - PAD_R;
  const plotH    = SVG_H - PAD_T - PAD_B;

  const values   = data.map(d => d.value);
  const minVal   = Math.min(...values);
  const maxVal   = Math.max(...values);
  const valRange = maxVal - minVal || 1;

  const n        = data.length;
  const stepX    = plotW / (n - 1);

  function toX(i: number) { return PAD_L + i * stepX; }
  function toY(v: number) { return PAD_T + plotH - ((v - minVal) / valRange) * plotH; }

  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');

  return (
    <View>
      {/* y-axis min/max labels */}
      <View style={s.yLabels}>
        <Text style={s.yLabel}>{maxVal}{unit}</Text>
        <Text style={s.yLabel}>{minVal}{unit}</Text>
      </View>

      <Svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
        {/* Line */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const isLast = i === n - 1;
          const cx     = toX(i);
          const cy     = toY(d.value);
          return (
            <React.Fragment key={`${d.label}-${i}`}>
              {/* outer ring for last point */}
              {isLast && (
                <Circle cx={cx} cy={cy} r={8} fill={color + '30'} />
              )}
              <Circle
                cx={cx}
                cy={cy}
                r={isLast ? 5 : 3}
                fill={color}
              />
              {/* value label above dot */}
              <SvgText
                x={cx}
                y={cy - 10}
                fontSize={9}
                fill={C.textSub}
                textAnchor="middle"
              >
                {d.value}{unit}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* x labels */}
      <XLabels labels={data.map(d => d.label)} width={SVG_W} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  empty: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 32,
  },
  emptyText: {
    ...T.label,
    color:      C.textDim,
    textAlign:  'center',
    lineHeight: 20,
  },
  yLabels: {
    position:       'absolute',
    left:           0,
    top:            16,
    bottom:         12,
    width:          32,
    justifyContent: 'space-between',
    alignItems:     'flex-end',
  },
  yLabel: {
    fontSize:   9,
    color:      C.textDim,
    fontWeight: '600',
  },
  xLabels: {
    height:     20,
    position:   'relative',
    marginTop:  2,
    marginLeft: 36,
  },
  xLabel: {
    fontSize:   9,
    color:      C.textSub,
    textAlign:  'center',
  },
});
