import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal,
  TouchableOpacity, SafeAreaView, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.floor((SCREEN_W - 48) / 2);

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const BODY_PARTS: { name: string; icon: IoniconName; color: string; bg: string }[] = [
  { name: 'Chest',     icon: 'body-outline',    color: '#5ba4ff', bg: '#5ba4ff18' },
  { name: 'Back',      icon: 'barbell-outline', color: '#cc5de8', bg: '#cc5de818' },
  { name: 'Legs',      icon: 'walk-outline',    color: '#ff922b', bg: '#ff922b18' },
  { name: 'Shoulders', icon: 'person-outline',  color: '#ffd166', bg: '#ffd16618' },
  { name: 'Arms',      icon: 'fitness-outline', color: '#3dd68c', bg: '#3dd68c18' },
];

const SIZE_OPTIONS: { label: string; size: number; sub: string }[] = [
  { label: '32강',  size: 32,  sub: '가장 빠른 토너먼트' },
  { label: '64강',  size: 64,  sub: '표준 토너먼트' },
  { label: '128강', size: 128, sub: '대규모 토너먼트' },
];

interface Props {
  onSelectBodyPart: (bodyPart: string, tournamentSize: number) => void;
  onViewRankings: () => void;
  onClose: () => void;
}

export default function OlympicHomeScreen({ onSelectBodyPart, onViewRankings, onClose }: Props) {
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [sizeSheetVisible,  setSizeSheetVisible] = useState(false);

  function handleBodyPartPress(name: string) {
    setSelectedBodyPart(name);
    setSizeSheetVisible(true);
  }

  function handleSizeSelect(size: number) {
    setSizeSheetVisible(false);
    if (selectedBodyPart) {
      onSelectBodyPart(selectedBodyPart, size);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.trophyWrap}>
            <Ionicons name="trophy" size={26} color={C.accent} />
          </View>
          <View>
            <Text style={s.headerTitle}>머신 올림픽</Text>
            <Text style={s.headerSub}>내가 좋아하는 머신은?</Text>
          </View>
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.textSub} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Hero banner */}
        <View style={s.hero}>
          <Ionicons name="trophy-outline" size={48} color={C.accent} style={{ opacity: 0.25, position: 'absolute', right: 20, top: 12 }} />
          <Text style={s.heroTitle}>머신 토너먼트</Text>
          <Text style={s.heroSub}>부위를 선택하고 배틀을 시작하세요.{'\n'}투표 결과로 인기 머신 랭킹이 만들어져요.</Text>
        </View>

        {/* Body part grid */}
        <Text style={s.sectionLabel}>부위 선택</Text>
        <View style={s.grid}>
          {BODY_PARTS.map((bp) => (
            <TouchableOpacity
              key={bp.name}
              style={[s.bpCard, { width: CARD_W, borderColor: bp.color + '40', backgroundColor: bp.bg }]}
              onPress={() => handleBodyPartPress(bp.name)}
              activeOpacity={0.8}
            >
              <View style={[s.bpIconWrap, { backgroundColor: bp.color + '22' }]}>
                <Ionicons name={bp.icon} size={32} color={bp.color} />
              </View>
              <Text style={[s.bpName, { color: bp.color }]}>{bp.name}</Text>
              <View style={s.bpArrow}>
                <Ionicons name="chevron-forward" size={14} color={bp.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rankings button */}
        <TouchableOpacity style={s.rankBtn} onPress={onViewRankings} activeOpacity={0.85}>
          <Ionicons name="podium-outline" size={18} color={C.bg} />
          <Text style={s.rankBtnText}>전체 랭킹 보기</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 대회 규모 선택 바텀시트 */}
      <Modal
        visible={sizeSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSizeSheetVisible(false)}
      >
        <TouchableOpacity
          style={s.sheetDim}
          activeOpacity={1}
          onPress={() => setSizeSheetVisible(false)}
        />
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>대회 규모 선택</Text>
            <TouchableOpacity onPress={() => setSizeSheetVisible(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={C.textSub} />
            </TouchableOpacity>
          </View>
          <View style={s.sheetDivider} />
          {SIZE_OPTIONS.map((opt, idx) => (
            <TouchableOpacity
              key={opt.size}
              style={[s.sheetRow, idx < SIZE_OPTIONS.length - 1 && s.sheetRowBorder]}
              onPress={() => handleSizeSelect(opt.size)}
              activeOpacity={0.8}
            >
              <Text style={s.sheetRowLabel}>{opt.label}</Text>
              <Text style={s.sheetRowSub}>{opt.sub}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 24 }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trophyWrap:  { width: 42, height: 42, borderRadius: R.inner, backgroundColor: C.accent + '18', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...T.section, color: C.text, fontWeight: '800' },
  headerSub:   { ...T.micro, color: C.textSub, marginTop: 1 },
  closeBtn:    { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  hero: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    padding: 20, marginVertical: 16, overflow: 'hidden',
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: C.accent, marginBottom: 6 },
  heroSub:   { ...T.body, color: C.textSub, lineHeight: 22 },

  sectionLabel: { ...T.label, color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },

  bpCard: {
    borderRadius: R.card, borderWidth: 1,
    padding: 16, alignItems: 'center', gap: 10,
    position: 'relative',
  },
  bpIconWrap: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  bpName:     { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  bpArrow:    { position: 'absolute', top: 10, right: 10 },

  rankBtn: {
    backgroundColor: C.accent, borderRadius: R.btn, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  rankBtnText: { ...T.body, color: C.bg, fontWeight: '800' },

  // Bottom sheet
  sheetDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginHorizontal: 20,
  },
  sheetRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 4,
  },
  sheetRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  sheetRowLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
  },
  sheetRowSub: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: '400',
  },
});
