import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../../theme';
import { MachineStat, MachineAvgStats } from '../../../lib/db/gymStats';
import { getMachineImageUrl } from '../../../lib/machineImageUrl';
import { s } from './statsStyles';

// 매니저 이용 통계 — 머신 탭 (F5-2). 이용 순위 / 부위별 / 평균 분석 — 기존 탭 내용을 그대로 이동.

const MACHINE_IMG_URL = (id: string) => getMachineImageUrl(id, { width: 96 });

const MUSCLE_ORDER = ['Chest', 'Back', 'Leg', 'Shoulder', 'Arms', 'Glutes', 'Other'];

type Section = 'usage' | 'muscle' | 'avg';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'usage',  label: '이용 순위' },
  { key: 'muscle', label: '부위별' },
  { key: 'avg',    label: '평균 분석' },
];

interface Props {
  machineStats: MachineStat[];
  topByMuscle:  Record<string, MachineStat[]>;
  avgStats:     MachineAvgStats[];
}

export default function MachineTab({ machineStats, topByMuscle, avgStats }: Props) {
  const [section, setSection] = useState<Section>('usage');

  const totalUsage = machineStats.reduce((sum, m) => sum + m.usageCount, 0);
  const maxUsage   = machineStats.length > 0 ? machineStats[0].usageCount : 1;

  const muscleKeys = Object.keys(topByMuscle).sort((a, b) => {
    const ai = MUSCLE_ORDER.indexOf(a);
    const bi = MUSCLE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SECTIONS.map(sec => (
          <TouchableOpacity
            key={sec.key}
            style={[s.periodChip, section === sec.key && s.periodChipActive]}
            onPress={() => setSection(sec.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.periodChipText, section === sec.key && s.periodChipTextActive]}>{sec.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 머신별 이용횟수 ── */}
      {section === 'usage' && (
        <View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>총 이용 횟수</Text>
            <Text style={s.summaryValue}>{totalUsage}회</Text>
          </View>
          {machineStats.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="bar-chart-outline" size={36} color={C.textDim} />
              <Text style={s.emptyText}>해당 기간에 운동 기록이 없어요</Text>
            </View>
          ) : (
            <View style={s.card}>
              {machineStats.map((m, i) => (
                <View key={m.machineId} style={[s.machineRow, i > 0 && s.divider]}>
                  <View style={s.machineRankBadge}>
                    <Text style={s.machineRank}>{i + 1}</Text>
                  </View>
                  <Image
                    source={{ uri: MACHINE_IMG_URL(m.machineId) }}
                    style={s.machineImg}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.machineNameRow}>
                      <Text style={s.machineName} numberOfLines={1}>{m.machineName}</Text>
                      <Text style={s.machineCount}>{m.usageCount}회</Text>
                    </View>
                    <Text style={s.machineBrand}>{m.machineBrand} · {m.targetMuscle}</Text>
                    <View style={s.usageBarBg}>
                      <View style={[s.usageBarFill, { width: `${(m.usageCount / maxUsage) * 100}%` }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── 부위별 TOP 10 ── */}
      {section === 'muscle' && (
        <View style={{ gap: 16 }}>
          {muscleKeys.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="trophy-outline" size={36} color={C.textDim} />
              <Text style={s.emptyText}>해당 기간에 운동 기록이 없어요</Text>
            </View>
          ) : (
            muscleKeys.map(muscle => (
              <View key={muscle}>
                <Text style={s.muscleHeader}>{muscle.toUpperCase()}</Text>
                <View style={s.card}>
                  {topByMuscle[muscle].map((m, i) => (
                    <View key={m.machineId} style={[s.machineRow, i > 0 && s.divider]}>
                      <View style={[s.machineRankBadge, i === 0 && s.machineRankBadgeTop]}>
                        <Text style={[s.machineRank, i === 0 && s.machineRankTop]}>{i + 1}</Text>
                      </View>
                      <Image
                        source={{ uri: MACHINE_IMG_URL(m.machineId) }}
                        style={s.machineImg}
                        resizeMode="contain"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.machineName} numberOfLines={1}>{m.machineName}</Text>
                        <Text style={s.machineBrand}>{m.machineBrand}</Text>
                      </View>
                      <Text style={s.machineCount}>{m.usageCount}회</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── 평균 분석 ── */}
      {section === 'avg' && (
        <View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>머신별 평균 세트/중량</Text>
          </View>
          {avgStats.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="analytics-outline" size={36} color={C.textDim} />
              <Text style={s.emptyText}>해당 기간에 데이터가 없어요</Text>
            </View>
          ) : (
            <View style={s.card}>
              {avgStats.map((m, i) => (
                <View key={m.machineId} style={[s.machineRow, i > 0 && s.divider]}>
                  <Image
                    source={{ uri: MACHINE_IMG_URL(m.machineId) }}
                    style={s.machineImg}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.machineName} numberOfLines={1}>{m.machineName}</Text>
                    <Text style={s.machineBrand}>{m.machineBrand} · {m.targetMuscle}</Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                      <Text style={s.avgChip}>평균 {m.avgSets}세트</Text>
                      {m.avgWeight > 0 && (
                        <Text style={s.avgChip}>{m.avgWeight} kg</Text>
                      )}
                      <Text style={[s.avgChip, { color: C.textDim }]}>{m.usageCount}회 이용</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
