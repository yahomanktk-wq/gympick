import React from 'react';
import { View, StyleSheet } from 'react-native';
import MachineCard, { MachineCardMachine } from './MachineCard';
import MachineCardBorder from './MachineCardBorder';
import MachineLevelBadge from './MachineLevelBadge';
import { getMachineLevelData } from '../data/machineLevelStore';

type Props = {
  machineId: string;
  machine:   MachineCardMachine;
  variant?:  'grid' | 'detail';
  width?:    number;
};

export default function MachineCardWithLevel({ machineId, machine, variant, width }: Props) {
  const levelData = getMachineLevelData(machineId);

  return (
    <View style={s.wrapper}>
      <MachineCardBorder>
        <MachineCard machine={machine} variant={variant} width={width} />
      </MachineCardBorder>
      {levelData && levelData.level > 0 && (
        <View style={s.badgeOverlay}>
          <MachineLevelBadge level={levelData.level} size="small" />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  badgeOverlay: {
    position: 'absolute',
    top:      8,
    right:    8,
  },
});
