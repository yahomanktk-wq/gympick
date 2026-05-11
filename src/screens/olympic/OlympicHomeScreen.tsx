import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal,
  TouchableOpacity, SafeAreaView, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { supabase } from '../../lib/supabase';
import ChestIcon     from '../../assets/muscle-icons/chest.svg';
import BackIcon      from '../../assets/muscle-icons/back.svg';
import ShouldersIcon from '../../assets/muscle-icons/shoulders.svg';
import ArmsIcon      from '../../assets/muscle-icons/arms.svg';
import LegsIcon      from '../../assets/muscle-icons/legs.svg';
import GlutesIcon    from '../../assets/muscle-icons/glutes.svg';

const { width: SCREEN_W } = Dimensions.get('window');
const MUSCLE_CARD_W = Math.floor((SCREEN_W - 44) / 2);

type SvgComponent = React.FC<{ width?: number; height?: number; color?: string }>;

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:     { fg: '#5ba4ff', bg: '#5ba4ff18' },
  Back:      { fg: '#cc5de8', bg: '#cc5de818' },
  Legs:      { fg: '#ff922b', bg: '#ff922b18' },
  Shoulders: { fg: '#ffd166', bg: '#ffd16618' },
  Arms:      { fg: '#3dd68c', bg: '#3dd68c18' },
  Glutes:    { fg: '#ff9ecd', bg: '#ff9ecd18' },
};

function mp(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: '#aaa', bg: '#aaa18' };
}

const BODY_PARTS: { name: string; sub: string; SvgIcon: SvgComponent }[] = [
  { name: 'Chest',     sub: 'Pectorals',         SvgIcon: ChestIcon     },
  { name: 'Back',      sub: 'Lats & Rhomboids',  SvgIcon: BackIcon      },
  { name: 'Shoulders', sub: 'Deltoids',           SvgIcon: ShouldersIcon },
  { name: 'Arms',      sub: 'Biceps & Triceps',   SvgIcon: ArmsIcon      },
  { name: 'Legs',      sub: 'Quads & Hamstrings', SvgIcon: LegsIcon      },
  { name: 'Glutes',    sub: 'Glutes & Hip',       SvgIcon: GlutesIcon    },
];

const SIZE_OPTIONS: { label: string; size: number; sub: string }[] = [
  { label: '32강',  size: 32,  sub: '가장 빠른 토너먼트' },
  { label: '64강',  size: 64,  sub: '표준 토너먼트' },
  { label: '128강', size: 128, sub: '대규모 토너먼트' },
];

interface Props {
  onSelectBodyPart: (bodyPart: string, category: string, tournamentSize: number) => void;
  onViewRankings: () => void;
  onClose: () => void;
}

function OlympicMuscleCard({ name, sub, SvgIcon, onPress }: {
  name: string; sub: string; SvgIcon: SvgComponent; onPress: () => void;
}) {
  const col = mp(name);
  return (
    <TouchableOpacity
      style={[s.muscleCard, { width: MUSCLE_CARD_W, borderColor: col.fg + '40', backgroundColor: col.bg }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <SvgIcon width={60} height={60} color={col.fg} />
      <Text style={[s.muscleCardName, { color: col.fg }]}>{name}</Text>
      <Text style={s.muscleCardSub}>{sub}</Text>
      <View style={s.muscleCardArrow}>
        <Ionicons name="chevron-forward" size={14} color={col.fg} />
      </View>
    </TouchableOpacity>
  );
}

export default function OlympicHomeScreen({ onSelectBodyPart, onViewRankings, onClose }: Props) {
  const [selectedBodyPart,     setSelectedBodyPart]     = useState<string | null>(null);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [sizeSheetVisible,     setSizeSheetVisible]     = useState(false);
  const [categories,           setCategories]           = useState<string[]>([]);
  const [selectedCategory,     setSelectedCategory]     = useState<string | null>(null);
  const [categoriesLoading,    setCategoriesLoading]    = useState(false);

  const fetchCategories = useCallback(async (bodyPart: string) => {
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('category')
        .or(`target_muscle.ilike.${bodyPart}`)
        .not('category', 'is', null)
        .neq('category', '');

      if (error) throw error;

      const raw = (data ?? []).map((r: { category: string }) => r.category);
      const all = new Set<string>();
      raw.forEach(cat => {
        cat.split(',').forEach(part => {
          const trimmed = part.trim();
          if (trimmed && !trimmed.includes('_Etc') && trimmed !== 'Free Weight') {
            all.add(trimmed);
          }
        });
      });

      setCategories(['전체', ...Array.from(all).sort()]);
    } catch (e) {
      if (__DEV__) console.warn('[OlympicHomeScreen] fetchCategories 오류:', e);
      setCategories(['전체']);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  function handleBodyPartPress(name: string) {
    setSelectedBodyPart(name);
    setSelectedCategory(null);
    fetchCategories(name);
    setCategorySheetVisible(true);
  }

  function handleCategorySelect(category: string) {
    setSelectedCategory(category);
    setCategorySheetVisible(false);
    setSizeSheetVisible(true);
  }

  function handleSizeSelect(size: number) {
    setSizeSheetVisible(false);
    if (selectedBodyPart && selectedCategory !== null) {
      onSelectBodyPart(selectedBodyPart, selectedCategory, size);
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
            <OlympicMuscleCard
              key={bp.name}
              name={bp.name}
              sub={bp.sub}
              SvgIcon={bp.SvgIcon}
              onPress={() => handleBodyPartPress(bp.name)}
            />
          ))}
        </View>

        {/* Rankings button */}
        <TouchableOpacity style={s.rankBtn} onPress={onViewRankings} activeOpacity={0.85}>
          <Ionicons name="podium-outline" size={18} color={C.bg} />
          <Text style={s.rankBtnText}>전체 랭킹 보기</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Category 선택 바텀시트 */}
      <Modal
        visible={categorySheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategorySheetVisible(false)}
      >
        <TouchableOpacity
          style={s.sheetDim}
          activeOpacity={1}
          onPress={() => setCategorySheetVisible(false)}
        />
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>
              {selectedBodyPart} — 카테고리 선택
            </Text>
            <TouchableOpacity onPress={() => setCategorySheetVisible(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={C.textSub} />
            </TouchableOpacity>
          </View>
          <View style={s.sheetDivider} />
          {categoriesLoading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ color: C.textDim, fontSize: 13 }}>불러오는 중...</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {categories.map((cat, idx) => (
                <TouchableOpacity
                  key={cat}
                  style={[s.sheetRow, idx < categories.length - 1 && s.sheetRowBorder]}
                  onPress={() => handleCategorySelect(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={s.sheetRowLabel}>{cat}</Text>
                  {cat === '전체' && (
                    <Text style={s.sheetRowSub}>전체 {selectedBodyPart} 머신</Text>
                  )}
                </TouchableOpacity>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

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

  muscleCard: {
    borderRadius: R.card,
    borderWidth: 1.5,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  muscleCardName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  muscleCardSub: {
    fontSize: 11,
    color: C.textSub,
    fontWeight: '500',
    textAlign: 'center',
  },
  muscleCardArrow: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  rankBtn: {
    backgroundColor: C.accent, borderRadius: R.btn, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  rankBtnText: { ...T.body, color: C.bg, fontWeight: '800' },

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
