import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../../../theme';
import { s } from './statsStyles';

// 매니저 이용 통계 — 요일 × 시간대 히트맵 (F5-3).
// grid[weekday 0=일..6=토][hour 0..23] = 그 요일·시간대의 운동 세션 수 (KST).
// 행은 월→일 순서, 칸 색은 최댓값 대비 세션 수(0이면 빈 칸 색).

const ROW_ORDER: { weekday: number; label: string }[] = [
  { weekday: 1, label: '월' },
  { weekday: 2, label: '화' },
  { weekday: 3, label: '수' },
  { weekday: 4, label: '목' },
  { weekday: 5, label: '금' },
  { weekday: 6, label: '토' },
  { weekday: 0, label: '일' },
];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const LABEL_W = 20;
const CELL_MARGIN = 1;

// 시간 축 라벨: 0, 6, 12, 18, 23 위치에 표시 (각 구간을 flex 가중치로 배치)
const AXIS_MARKS: { hour: number; text: string }[] = [
  { hour: 0,  text: '0시' },
  { hour: 6,  text: '6' },
  { hour: 12, text: '12' },
  { hour: 18, text: '18' },
  { hour: 23, text: '23' },
];

const LEGEND_LEVELS = [0.25, 0.5, 0.75, 1];

function cellOpacity(count: number, max: number): number {
  return 0.2 + 0.8 * (count / max);
}

function HeatCell({ count, max }: { count: number; max: number }) {
  return (
    <View style={{ flex: 1, height: 16, margin: CELL_MARGIN }}>
      {count === 0 ? (
        <View style={{ flex: 1, borderRadius: 3, backgroundColor: C.surfaceHigh }} />
      ) : (
        <View style={{ flex: 1, borderRadius: 3, backgroundColor: C.accent, opacity: cellOpacity(count, max) }} />
      )}
    </View>
  );
}

function HeatRow({ label, counts, max }: { label: string; counts: number[]; max: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ width: LABEL_W, fontSize: 11, color: C.textSub }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {HOURS.map(h => <HeatCell key={h} count={counts[h] ?? 0} max={max} />)}
      </View>
    </View>
  );
}

function HourAxis() {
  // 각 라벨은 자기 시간 칸부터 다음 라벨 직전 칸까지의 폭(flex)을 차지 → 칸 위치와 정렬됨
  return (
    <View style={{ flexDirection: 'row', marginTop: 4 }}>
      <View style={{ width: LABEL_W }} />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {AXIS_MARKS.map((m, i) => {
          const next = AXIS_MARKS[i + 1]?.hour ?? 24;
          return (
            <Text key={m.hour} style={{ flex: next - m.hour, fontSize: 10, color: C.textDim, paddingLeft: CELL_MARGIN }}>
              {m.text}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function Legend() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
      <Text style={{ fontSize: 10, color: C.textDim }}>적음</Text>
      {LEGEND_LEVELS.map(level => (
        <View
          key={level}
          style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: C.accent, opacity: 0.2 + 0.8 * level }}
        />
      ))}
      <Text style={{ fontSize: 10, color: C.textDim }}>많음</Text>
    </View>
  );
}

interface Props {
  grid: number[][];   // [weekday 0=Sun..6][hour 0..23]
}

export default function PeakHeatmap({ grid }: Props) {
  // 최댓값 칸 — 동률이면 월→일 순서상 앞 요일, 그다음 이른 시간
  let max = 0;
  let peak: { label: string; hour: number } | null = null;
  for (const { weekday, label } of ROW_ORDER) {
    for (const h of HOURS) {
      const count = grid[weekday]?.[h] ?? 0;
      if (count > max) {
        max = count;
        peak = { label, hour: h };
      }
    }
  }

  if (max === 0 || !peak) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyText}>운동 기록이 더 쌓이면 붐비는 시간이 보여요</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10 }}>
        가장 붐비는 시간: {peak.label} {peak.hour}시
      </Text>
      {ROW_ORDER.map(({ weekday, label }) => (
        <HeatRow key={weekday} label={label} counts={grid[weekday] ?? []} max={max} />
      ))}
      <HourAxis />
      <Legend />
    </View>
  );
}
