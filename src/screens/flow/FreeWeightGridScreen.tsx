// FreeWeightGridScreen.tsx — 프리웨이트 전용 독립 화면 (FlatList 기반)
//
// ExerciseSelectStep 안의 거대한 ScrollView(루틴 머신 / 전체 머신 / 일반 머신 그리드와
// 공유)를 건드리지 않기 위해, 프리웨이트 그리드만 별도 화면으로 분리했다.
// 성능(Gym Visual GIF, fw45~fw173가 한 번에 100개 넘게 동시 재생되는 것 방지)은
// FlatList 자체의 windowSize/removeClippedSubviews 가상화(화면 밖 카드는 아예
// 마운트 해제됨)에 맡긴다 — 예전에는 onViewableItemsChanged로 카드별 autoplay를
// 매번 켜고/껐는데, 한 번 autoplay=false로 내려간 뒤 다시 true로 바뀌어도
// expo-image가 재생을 재개하지 않는 경우가 있어서(스크롤 후 정지된 GIF) 제거함.
//
// ExerciseSelectStep의 기존 카드 선택 흐름(카드 탭 → 로컬 선택 → 하단 CTA로 확정)을
// 그대로 재현하며, 확정 시 부모가 넘겨준 onSelect(id)를 그대로 호출한다 — 상위 5단계
// 플로우(Step/ORDER/renderStep)는 전혀 건드리지 않는다.

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R, T } from '../../theme';
import MachineCard from '../../components/MachineCard';
import MachineCardBorder from '../../components/MachineCardBorder';
import { FreeWeightExercise } from '../../data/freeWeights';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W   = (SCREEN_W - 40) / 2;

interface Props {
  visible: boolean;
  freeWeights: FreeWeightExercise[];
  /** 루틴에 포함된 프리웨이트 id → 순번 배지 표시용 */
  preloadedIds: Set<string>;
  /** 오늘 이미 기록을 완료한 프리웨이트 id (machineIdFromKey로 걸러진 순수 id 집합) */
  completedIds: Set<string>;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function FreeWeightGridScreen({
  visible, freeWeights, preloadedIds, completedIds, onSelect, onClose,
}: Props) {
  // 상위 ExerciseSelectStep의 SafeAreaView 안에 이 화면을 그대로 얹으면(예: 중첩된
  // <Modal>) 일부 기기/iOS 버전에서 두 번째 Modal의 safe-area 상단 인셋이 잘못
  // 계산되어 뒤로가기 버튼이 상태바 뒤로 숨는 문제가 있었다. 그래서 별도 Modal을
  // 쓰지 않고, 이미 열려있는 상위 Modal 안에 절대 위치 오버레이로 그리면서
  // useSafeAreaInsets()로 직접 상/하단 여백을 계산한다.
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 모든 훅 호출 이후에만 조건부 return — 훅 호출 순서를 렌더마다 동일하게 유지
  if (!visible) return null;

  function handleClose() {
    setSelectedId(null);
    onClose();
  }

  function handleConfirm() {
    if (!selectedId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = selectedId;
    setSelectedId(null);
    onSelect(id);
  }

  function handleCardPress(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedId(prev => prev === id ? null : id);
  }

  return (
    <View style={[s.safe, StyleSheet.absoluteFillObject, { paddingTop: insets.top, paddingBottom: insets.bottom, zIndex: 50, elevation: 50 }]}>
        <View style={s.navHeader}>
          <TouchableOpacity style={s.navBtn} onPress={handleClose} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={s.navTitle} numberOfLines={1}>프리웨이트 보기</Text>
          <View style={s.navBtn} />
        </View>

        <FlatList
          data={freeWeights}
          keyExtractor={fw => fw.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.listPad}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          renderItem={({ item: fw }) => {
            const isSelected = selectedId === fw.id;
            const orderIdx   = preloadedIds.has(fw.id) ? [...preloadedIds].indexOf(fw.id) : -1;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleCardPress(fw.id)}
                style={{ position: 'relative' }}
              >
                <MachineCardBorder width={CARD_W}>
                  <MachineCard
                    machine={{ id: fw.id, name: fw.name, brand: fw.brand, targetMuscle: fw.targetMuscle, category: 'Free Weight' }}
                    variant="grid"
                    width={CARD_W}
                  />
                </MachineCardBorder>
                {orderIdx !== -1 && (
                  <View style={s.cardOrderOverlay}>
                    <View style={s.cardOrderBadge}>
                      <Text style={s.cardOrderText}>{orderIdx + 1}</Text>
                    </View>
                  </View>
                )}
                {orderIdx === -1 && isSelected && (
                  <View style={s.cardSelectedOverlay}>
                    <View style={s.cardSelectedBadge}>
                      <Ionicons name="checkmark" size={14} color={C.bg} />
                    </View>
                  </View>
                )}
                {completedIds.has(fw.id) && (
                  <View style={s.cardCompletedOverlay}>
                    <View style={s.cardCompletedBadge}>
                      <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                      <Text style={s.cardCompletedTxt}>완료</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={s.emptyText}>표시할 프리웨이트가 없습니다.</Text>
          }
        />

        <View style={s.ctaBar}>
          <TouchableOpacity
            style={[s.ctaBtn, !selectedId && s.ctaDisabled]}
            activeOpacity={0.85}
            onPress={handleConfirm}
            disabled={!selectedId}
          >
            <Ionicons name="play" size={18} color={C.bg} />
            <Text style={s.ctaTxt}>이 프리웨이트로 운동 시작</Text>
          </TouchableOpacity>
        </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  navHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12 },
  navBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle:  { flex: 1, textAlign: 'center', ...T.section, color: C.text },
  listPad:   { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  row:       { gap: 8 },
  emptyText: { fontSize: 13, color: C.textSub, textAlign: 'center', marginTop: 40 },

  cardOrderOverlay: { position: 'absolute', top: 8, left: 8 },
  cardOrderBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  cardOrderText: { fontSize: 13, fontWeight: '900', color: C.bg },
  cardSelectedOverlay: { position: 'absolute', top: 8, right: 8 },
  cardSelectedBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  cardCompletedOverlay: { position: 'absolute', top: 8, right: 8 },
  cardCompletedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: R.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  cardCompletedTxt: { fontSize: 11, fontWeight: '700', color: C.accent },

  ctaBar:      { padding: 16, backgroundColor: C.bg },
  ctaBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 16 },
  ctaDisabled: { opacity: 0.35 },
  ctaTxt:      { fontSize: 15, fontWeight: '800', color: C.bg },
});
