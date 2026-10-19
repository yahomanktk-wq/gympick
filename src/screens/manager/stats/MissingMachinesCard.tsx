import React from 'react';
import { View, Text, Image } from 'react-native';
import { C } from '../../../theme';
import { GymInsights } from '../../../lib/db/gymStats';
import { getMachineImageUrl } from '../../../lib/machineImageUrl';
import { s } from './statsStyles';

// 매니저 이용 통계 — 개요 탭 '주변에서 찾았지만 우리 헬스장엔 없는 머신' (F5-4a).
// 근처 헬스장의 머신→보유 헬스장 검색 결과에 나왔지만 이 헬스장은 보유하지 않은 머신.

const MACHINE_IMG_URL = (id: string) => getMachineImageUrl(id, { width: 96 });

type MissingMachine = GymInsights['missingMachines'][number];

function MissingMachineRow({ machine, showDivider }: { machine: MissingMachine; showDivider: boolean }) {
  return (
    <View style={[s.machineRow, showDivider && s.divider]}>
      <Image
        source={{ uri: MACHINE_IMG_URL(machine.machineId) }}
        style={s.machineImg}
        resizeMode="contain"
      />
      <View style={{ flex: 1 }}>
        <Text style={s.machineName} numberOfLines={1}>{machine.name}</Text>
        <Text style={s.machineBrand}>{machine.brand}</Text>
      </View>
      <Text style={s.machineCount}>{machine.searchCount}회 검색</Text>
    </View>
  );
}

export default function MissingMachinesCard({ machines }: { machines: MissingMachine[] }) {
  return (
    <View style={s.card}>
      <Text style={s.chartTitle}>주변에서 찾았지만 우리 헬스장엔 없는 머신</Text>
      <Text style={{ fontSize: 11, color: C.textSub, paddingHorizontal: 14 }}>
        근처 헬스장 검색 결과에 나온 머신이에요
      </Text>
      {machines.length === 0 ? (
        <Text style={[s.emptyText, { padding: 16 }]}>아직 주변 검색 데이터가 없어요</Text>
      ) : (
        <View style={{ marginTop: 4 }}>
          {machines.map((m, i) => (
            <MissingMachineRow key={m.machineId} machine={m} showDivider={i > 0} />
          ))}
        </View>
      )}
    </View>
  );
}
