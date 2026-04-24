import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import SelectableMachineCard, { SelectableMachineCardMachine } from '../../components/SelectableMachineCard';
import MachineDetailModal from './MachineDetailModal';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 8;
const CARD_W   = (SCREEN_W - 32 - GRID_GAP) / 2;

const MUSCLE_OPTIONS = ['전체', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Glutes', 'Other'];

interface Props {
  visible:  boolean;
  gymId:    string;
  gymName:  string;
  machines: SelectableMachineCardMachine[];
  onClose:  () => void;
}

export default function GymAllMachinesScreen({ visible, gymId, gymName, machines, onClose }: Props) {
  const [activeMuscle, setActiveMuscle] = useState('전체');
  const [activeBrand,  setActiveBrand]  = useState('전체');
  const [selectedMachine, setSelectedMachine] = useState<SelectableMachineCardMachine | null>(null);

  const brands = useMemo(() => {
    const unique = [...new Set(machines.map(m => m.brand))].sort();
    return ['전체', ...unique];
  }, [machines]);

  const filteredMachines = useMemo(() => {
    return machines.filter(m => {
      const muscleOk = activeMuscle === '전체' || m.targetMuscle === activeMuscle;
      const brandOk  = activeBrand  === '전체' || m.brand        === activeBrand;
      return muscleOk && brandOk;
    });
  }, [machines, activeMuscle, activeBrand]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{gymName} 머신</Text>
          <View style={s.closeBtn} />
        </View>

        {/* Muscle filter */}
        <View>
          <Text style={s.filterLabel}>타겟 부위</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {MUSCLE_OPTIONS.map(opt => {
              const active = opt === activeMuscle;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[s.filterChip, active && s.filterChipActive]}
                  onPress={() => setActiveMuscle(opt)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Brand filter */}
        <View>
          <Text style={s.filterLabel}>브랜드</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {brands.map(opt => {
              const active = opt === activeBrand;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[s.filterChip, active && s.filterChipActive]}
                  onPress={() => setActiveBrand(opt)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={s.dividerLine} />

        {/* Machine grid */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.grid}>
          {filteredMachines.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>선택한 필터에 맞는 머신이 없어요.</Text>
            </View>
          ) : (
            <View style={s.machineGrid}>
              {filteredMachines.map(m => (
                <SelectableMachineCard
                  key={m.id}
                  machine={m}
                  width={CARD_W}
                  selected={false}
                  completed={false}
                  onSelect={() => setSelectedMachine(m)}
                />
              ))}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>

        <MachineDetailModal
          visible={selectedMachine !== null}
          machine={selectedMachine as any}
          onClose={() => setSelectedMachine(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  closeBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  filterLabel: {
    fontSize: 9, fontWeight: '700', color: C.textDim,
    letterSpacing: 1.2, textTransform: 'uppercase',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  filterRow:         { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  filterChip:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.surface },
  filterChipActive:  { backgroundColor: C.accent },
  filterChipText:    { fontSize: 14, fontWeight: '600', color: C.textSub },
  filterChipTextActive: { color: C.bg },

  dividerLine: { height: 1, backgroundColor: C.border, marginTop: 8 },

  grid: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  machineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },

  emptyState: { paddingVertical: 48, alignItems: 'center' },
  emptyText:  { fontSize: 13, color: C.textDim },
});
