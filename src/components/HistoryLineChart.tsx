import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText, Line } from 'react-native-svg';
import { C } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H_DEFAULT = 160;
const PAD_LEFT  = 44;
const PAD_RIGHT = 16;
const PAD_TOP   = 16;
const PAD_BOT   = 28;

type Props = {
  data:          { label: string; value: number }[];
  color?:        string;
  height?:       number;
  unit?:         string;
  title:         string;
  emptyMessage?: string;
};

export default function HistoryLineChart({
  data,
  color = C.accent,
  height = CHART_H_DEFAULT,
  unit = '',
  title,
  emptyMessage = '이 기간에 데이터가 없어요',
}: Props) {
  const chartW = SCREEN_W - 32;
  const innerW = chartW - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOT;

  if (data.length <= 1) {
    return (
      <View style={s.wrap}>
        <Text style={s.title}>{title}</Text>
        <View style={[s.emptyBox, { height }]}>
          <Text style={s.emptyText}>{emptyMessage}</Text>
        </View>
      </View>
    );
  }

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = maxVal - minVal || 1;

  function toX(i: number) {
    return PAD_LEFT + (i / (data.length - 1)) * innerW;
  }
  function toY(v: number) {
    return PAD_TOP + innerH - ((v - minVal) / range) * innerH;
  }

  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');
  const lastIdx = data.length - 1;
  const lastX   = toX(lastIdx);
  const lastY   = toY(data[lastIdx].value);

  // Show up to 5 x-axis labels evenly spaced
  const labelStep = Math.max(1, Math.floor(data.length / 5));
  const labelIndices = data.map((_, i) => i).filter(
    i => i === 0 || i === lastIdx || i % labelStep === 0,
  );

  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      <Svg width={chartW} height={height}>
        {/* y-axis guide lines */}
        <Line
          x1={PAD_LEFT} y1={PAD_TOP}
          x2={PAD_LEFT} y2={PAD_TOP + innerH}
          stroke={C.border} strokeWidth={1}
        />
        <Line
          x1={PAD_LEFT} y1={PAD_TOP + innerH}
          x2={PAD_LEFT + innerW} y2={PAD_TOP + innerH}
          stroke={C.border} strokeWidth={1}
        />

        {/* y-axis min / max labels */}
        <SvgText
          x={PAD_LEFT - 4} y={PAD_TOP + 4}
          fontSize={9} fill={C.textDim} textAnchor="end"
        >
          {maxVal}{unit}
        </SvgText>
        <SvgText
          x={PAD_LEFT - 4} y={PAD_TOP + innerH}
          fontSize={9} fill={C.textDim} textAnchor="end"
        >
          {minVal}{unit}
        </SvgText>

        {/* Polyline */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots */}
        {data.map((d, i) => (
          <Circle
            key={i}
            cx={toX(i)} cy={toY(d.value)}
            r={i === lastIdx ? 5 : 3}
            fill={i === lastIdx ? color : C.bg}
            stroke={color}
            strokeWidth={i === lastIdx ? 0 : 1.5}
          />
        ))}

        {/* Last point value label */}
        <SvgText
          x={lastX} y={lastY - 10}
          fontSize={10} fontWeight="700"
          fill={color} textAnchor="middle"
        >
          {data[lastIdx].value}{unit}
        </SvgText>

        {/* x-axis labels */}
        {labelIndices.map(i => (
          <SvgText
            key={i}
            x={toX(i)} y={PAD_TOP + innerH + 16}
            fontSize={9} fill={C.textDim} textAnchor="middle"
          >
            {data[i].label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { marginBottom: 8 },
  title:     { fontSize: 12, fontWeight: '700', color: C.textSub, marginBottom: 6 },
  emptyBox:  { alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderRadius: 12 },
  emptyText: { fontSize: 12, color: C.textDim },
});
