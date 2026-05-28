/**
 * TodayWorkoutListScreen
 * PostWorkoutLogModal 내부 스텝 컴포넌트.
 * RoutineReferenceScreen에서 선택한 machineIds를 받아 오늘 루틴 리스트를 보여줌.
 *
 * 기능:
 *  - 머신 순서 변경 (위/아래 버튼)
 *  - 머신 제거
 *  - 머신 추가 (헬스장 보유 머신 중 아직 추가 안 된 것)
 *  - "Start Workout" → onConfirm(orderedMachineIds)
 *
 * 세트/중량은 절대 자동 입력되지 않음 — 머신 순서만 관리.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R, T } from '../../theme';
import { Machine } from '../../data/types';
import { MACHINES } from '../../data';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TodayWorkoutListScreenProps {
  initialMachineIds: string[];   // from RoutineReferenceScreen (may be [])
  gymMachines: Machine[];        // all machines available at this gym
  selectedMuscles: string[];     // for filtering "Add Machine" section
  readOnly?: boolean;            // when true: hide add/remove/reorder controls
  extraMachineInfo?: Record<string, { name: string; brand: string; targetMuscle: string }>;
  onConfirm: (orderedMachineIds: string[]) => void;
  onBack: () => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:       { fg: '#4dabf7', bg: '#4dabf718' },
  Back:        { fg: '#cc5de8', bg: '#cc5de818' },
  Legs:        { fg: '#ff922b', bg: '#ff922b18' },
  Shoulders:   { fg: '#ffd166', bg: '#ffd16618' },
  Arms:        { fg: '#51cf66', bg: '#51cf6618' },
  Core:        { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
  Glutes:      { fg: '#ff9ecd', bg: '#ff9ecd18' },
};

function mc(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared atoms
// ─────────────────────────────────────────────────────────────────────────────

function NavHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <View style={s.navHeader}>
      {onBack ? (
        <TouchableOpacity style={s.navBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack!(); }} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
      ) : (
        <View style={s.navBtn} />
      )}
      <Text style={s.navTitle} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity style={s.navBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} activeOpacity={0.7}>
        <Ionicons name="close" size={20} color={C.textSub} />
      </TouchableOpacity>
    </View>
  );
}

function StepBar({ total, current }: { total: number; current: number }) {
  return (
    <View style={s.stepBar}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[s.stepSeg, { backgroundColor: i <= current ? C.accent : C.border }]}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine row in today's list
// ─────────────────────────────────────────────────────────────────────────────

function MachineListRow({
  machine,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  readOnly = false,
}: {
  machine: Machine;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const col = mc(machine.targetMuscle);
  const displayName = machine.displayName ?? machine.name;

  return (
    <View style={s.listRow}>
      {/* Order number */}
      <View style={s.orderBadge}>
        <Text style={s.orderNum}>{index + 1}</Text>
      </View>

      {/* Info */}
      <View style={s.listRowInfo}>
        <Text style={s.listRowName} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={s.listRowMeta}>
          <View style={[s.tag, { backgroundColor: col.bg }]}>
            <Text style={[s.tagText, { color: col.fg }]}>{machine.targetMuscle}</Text>
          </View>
          <Text style={s.listRowBrand}>{machine.brand}</Text>
        </View>
      </View>

      {/* Reorder & remove — hidden in readOnly mode */}
      {!readOnly && (
        <View style={s.listRowActions}>
          <TouchableOpacity
            style={[s.iconBtn, index === 0 && s.iconBtnDisabled]}
            onPress={onMoveUp}
            disabled={index === 0}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-up" size={16} color={index === 0 ? C.textDim : C.textSub} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, index === total - 1 && s.iconBtnDisabled]}
            onPress={onMoveDown}
            disabled={index === total - 1}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-down" size={16} color={index === total - 1 ? C.textDim : C.textSub} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, s.removeBtn]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onRemove(); }} activeOpacity={0.7}>
            <Ionicons name="close" size={16} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-machine row (available machines not yet added)
// ─────────────────────────────────────────────────────────────────────────────

function AddMachineRow({
  machine,
  onAdd,
}: {
  machine: Machine;
  onAdd: () => void;
}) {
  const col = mc(machine.targetMuscle);
  const displayName = machine.displayName ?? machine.name;

  return (
    <TouchableOpacity style={s.addRow} onPress={onAdd} activeOpacity={0.8}>
      <View style={[s.addRowIcon, { backgroundColor: col.bg }]}>
        <Ionicons name="barbell-outline" size={16} color={col.fg} />
      </View>
      <View style={s.listRowInfo}>
        <Text style={s.addRowName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={s.listRowBrand}>{machine.brand}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={22} color={C.accent} />
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

// 로컬 fallback (Supabase 로드 전 사용)
const LOCAL_MACHINES_MAP: Record<string, Machine> = Object.fromEntries(
  MACHINES.map((m) => [m.id, m]),
);

export default function TodayWorkoutListScreen({
  initialMachineIds,
  gymMachines,
  selectedMuscles,
  readOnly = false,
  extraMachineInfo,
  onConfirm,
  onBack,
  onClose,
}: TodayWorkoutListScreenProps) {
  const [orderedIds,        setOrderedIds]        = useState<string[]>(initialMachineIds);
  const [addExpanded,       setAddExpanded]       = useState(false);
  const [muscleFilter,      setMuscleFilter]      = useState<string | null>(null);
  const [dynamicMachineMap, setDynamicMachineMap] = useState<Record<string, Machine>>(LOCAL_MACHINES_MAP);

  // Supabase에서 전체 머신(프리웨이트 포함) 로드 → fw37 등 처리
  useEffect(() => {
    async function load() {
      try {
        const { fetchMachines } = await import('../../lib/db/machines');
        const all = await fetchMachines();
        if (all.length > 0) {
          setDynamicMachineMap(Object.fromEntries(all.map(m => [m.id, m as Machine])));
        }
      } catch (e) {
        if (__DEV__) console.warn('[TodayWorkoutListScreen] fetchMachines error:', e);
      }
    }
    load();
  }, []);

  // Build a lookup map for fast access
  const machineMap = useMemo(
    () => Object.fromEntries(gymMachines.map((m) => [m.id, m])),
    [gymMachines],
  );

  // Resolve: 헬스장 머신 → Supabase 전체 머신(프리웨이트 포함) → extraMachineInfo
  function resolveMachine(id: string): Machine | null {
    if (machineMap[id])        return machineMap[id];
    if (dynamicMachineMap[id]) return dynamicMachineMap[id];
    const extra = extraMachineInfo?.[id];
    if (extra) return { id, name: extra.name, brand: extra.brand, targetMuscle: extra.targetMuscle, category: 'Unknown' } as Machine;
    return null;
  }

  // Machines available to add (at this gym, not yet in list)
  const idSet = useMemo(() => new Set(orderedIds), [orderedIds]);
  const availableToAdd = useMemo(() => {
    const base = gymMachines.filter((m) => !idSet.has(m.id));
    if (muscleFilter) return base.filter((m) => m.targetMuscle === muscleFilter);
    // Default: show selected muscles first, then the rest
    const inMuscle = base.filter((m) => selectedMuscles.includes(m.targetMuscle));
    const rest = base.filter((m) => !selectedMuscles.includes(m.targetMuscle));
    return [...inMuscle, ...rest];
  }, [gymMachines, idSet, muscleFilter, selectedMuscles]);

  // Unique muscles available in add list (for filter chips)
  const availableMuscles = useMemo(
    () => [...new Set(gymMachines.filter((m) => !idSet.has(m.id)).map((m) => m.targetMuscle))],
    [gymMachines, idSet],
  );

  // ── Handlers ────────────────────────────────────────────────

  function moveUp(i: number) {
    if (i === 0) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }

  function moveDown(i: number) {
    setOrderedIds((prev) => {
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  }

  function remove(i: number) {
    setOrderedIds((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addMachine(machineId: string) {
    setOrderedIds((prev) => [...prev, machineId]);
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Today's Routine" onBack={onBack} onClose={onClose} />
      <StepBar total={6} current={3} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* ── Heading ─────────────────────────────────────── */}
        <View style={s.headRow}>
          <Text style={s.headLabel}>
            {orderedIds.length === 0
              ? '머신을 추가해보세요'
              : `${orderedIds.length}개 머신`}
          </Text>
          <Text style={s.headHint}>순서 변경 및 제거 가능</Text>
        </View>

        {/* ── Machine list ─────────────────────────────────── */}
        {orderedIds.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="barbell-outline" size={36} color={C.textDim} />
            <Text style={s.emptyTitle}>루틴이 비어 있어요</Text>
            <Text style={s.emptyHint}>아래 "머신 추가" 버튼으로 머신을 추가하거나{'\n'}바로 시작해도 됩니다</Text>
          </View>
        ) : (
          orderedIds.map((id, i) => {
            const machine = resolveMachine(id) ?? {
              id,
              name:         extraMachineInfo?.[id]?.name ?? id,
              brand:        extraMachineInfo?.[id]?.brand ?? '알 수 없음',
              targetMuscle: extraMachineInfo?.[id]?.targetMuscle ?? '',
              category:     '',
            } as Machine;
            return (
              <MachineListRow
                key={id}
                machine={machine}
                index={i}
                total={orderedIds.length}
                onMoveUp={() => moveUp(i)}
                onMoveDown={() => moveDown(i)}
                onRemove={() => remove(i)}
                readOnly={readOnly}
              />
            );
          })
        )}

        {/* ── Add Machine section (hidden in readOnly mode) ─── */}
        {!readOnly && (
          <>
            <TouchableOpacity
              style={s.addToggleBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAddExpanded((v) => !v); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={addExpanded ? 'chevron-up' : 'add'}
                size={18}
                color={C.accent}
              />
              <Text style={s.addToggleText}>머신 추가</Text>
              {availableToAdd.length > 0 && (
                <View style={s.addCountBadge}>
                  <Text style={s.addCountText}>{availableToAdd.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            {addExpanded && (
              <View style={s.addPanel}>
                {/* Muscle filter chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.filterRow}
                >
                  <TouchableOpacity
                    style={[s.filterChip, !muscleFilter && s.filterChipActive]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMuscleFilter(null); }}
                  >
                    <Text style={[s.filterChipText, !muscleFilter && s.filterChipTextActive]}>
                      전체
                    </Text>
                  </TouchableOpacity>
                  {availableMuscles.map((m) => {
                    const active = muscleFilter === m;
                    const col = mc(m);
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          s.filterChip,
                          active && { backgroundColor: col.bg, borderColor: col.fg + '60' },
                        ]}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMuscleFilter(active ? null : m); }}
                      >
                        <Text style={[s.filterChipText, active && { color: col.fg }]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {availableToAdd.length === 0 ? (
                  <View style={s.addEmptyBox}>
                    <Text style={s.addEmptyText}>추가할 수 있는 머신이 없어요</Text>
                  </View>
                ) : (
                  availableToAdd.map((machine) => (
                    <AddMachineRow
                      key={machine.id}
                      machine={machine}
                      onAdd={() => addMachine(machine.id)}
                    />
                  ))
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <View style={s.ctaBar}>
        <TouchableOpacity
          style={s.ctaBtn}
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onConfirm(orderedIds); }}
        >
          <Text style={s.ctaTxt}>
            {orderedIds.length === 0 ? 'Start Workout' : `Start Workout — ${orderedIds.length} machines`}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={C.bg} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // NavHeader
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  // StepBar
  stepBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 10 },
  stepSeg: { flex: 1, height: 3, borderRadius: 2 },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  // Heading
  headRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headLabel: { ...T.section, color: C.text },
  headHint: { ...T.micro, color: C.textDim },

  // Machine list row
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    marginBottom: 8,
    padding: 12,
    gap: 10,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderNum: { ...T.label, color: C.textSub, fontWeight: '700' },
  listRowInfo: { flex: 1, gap: 4 },
  listRowName: { ...T.body, color: C.text, fontWeight: '600' },
  listRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listRowBrand: { ...T.micro, color: C.textDim },
  tag: { borderRadius: R.pill, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { ...T.micro },

  // Action buttons
  listRowActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: R.inner,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.surfaceHigh,
  },
  iconBtnDisabled: { opacity: 0.3 },
  removeBtn: { backgroundColor: '#ff6b6b18', marginLeft: 2 },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyTitle: { ...T.body, color: C.textSub, fontWeight: '600' },
  emptyHint: { ...T.label, color: C.textDim, textAlign: 'center' },

  // Add Machine toggle
  addToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.accent + '40',
  },
  addToggleText: { ...T.body, color: C.accent, flex: 1, fontWeight: '600' },
  addCountBadge: {
    backgroundColor: C.accent,
    borderRadius: R.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  addCountText: { ...T.micro, color: C.bg, fontWeight: '700' },

  // Add panel
  addPanel: {
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.accent + '18',
    borderColor: C.accent + '60',
  },
  filterChipText: { ...T.label, color: C.textSub },
  filterChipTextActive: { color: C.accent },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  addRowIcon: {
    width: 32,
    height: 32,
    borderRadius: R.inner,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRowName: { ...T.body, color: C.text, fontWeight: '500' },
  addEmptyBox: { paddingVertical: 16, alignItems: 'center' },
  addEmptyText: { ...T.label, color: C.textDim },

  // CTA
  ctaBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  ctaBtn: {
    backgroundColor: C.accent,
    borderRadius: R.btn,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaTxt: { ...T.body, color: C.bg, fontWeight: '700' },
});
