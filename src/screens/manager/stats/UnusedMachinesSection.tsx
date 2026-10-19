import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../../theme';
import { OwnedMachineInfo } from '../../../lib/db/gymStats';
import { getMachineImageUrl } from '../../../lib/machineImageUrl';
import { s } from './statsStyles';

// 매니저 이용 통계 — 머신 탭 '미사용' (F5-4b). 보유 머신 중 기간 내 한 번도 기록되지 않은 머신.

const MACHINE_IMG_URL = (id: string) => getMachineImageUrl(id, { width: 96 });

interface Props {
  unusedMachines:  OwnedMachineInfo[] | null;   // null = 조회 실패
  ownedCount:      number;
  ownedLoadFailed: boolean;
}

function UnusedMachineRow({ machine, showDivider }: { machine: OwnedMachineInfo; showDivider: boolean }) {
  return (
    <View style={[s.machineRow, showDivider && s.divider]}>
      <Image
        source={{ uri: MACHINE_IMG_URL(machine.machineId) }}
        style={s.machineImg}
        resizeMode="contain"
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.machineName} numberOfLines={1}>{machine.machineName}</Text>
        <Text style={s.machineBrand}>{machine.machineBrand} · {machine.targetMuscle.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function EmptyNote({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={s.emptyWrap}>
      <Ionicons name={icon} size={36} color={C.textDim} />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

export default function UnusedMachinesSection({ unusedMachines, ownedCount, ownedLoadFailed }: Props) {
  if (ownedLoadFailed || unusedMachines === null) {
    return <EmptyNote icon="alert-circle-outline" text="보유 머신 정보를 불러오지 못했어요." />;
  }
  if (ownedCount === 0) {
    return <EmptyNote icon="barbell-outline" text="보유 머신이 등록되지 않았어요." />;
  }

  return (
    <View>
      <View style={s.summaryRow}>
        <Text style={s.summaryLabel}>기간 중 한 번도 기록되지 않은 머신 {unusedMachines.length}대</Text>
      </View>
      {unusedMachines.length === 0 ? (
        <EmptyNote icon="checkmark-circle-outline" text="모든 보유 머신이 기록됐어요 👏" />
      ) : (
        <View style={s.card}>
          {unusedMachines.map((m, i) => (
            <UnusedMachineRow key={m.machineId} machine={m} showDivider={i > 0} />
          ))}
        </View>
      )}
    </View>
  );
}
