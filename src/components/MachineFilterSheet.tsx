// src/components/MachineFilterSheet.tsx
//
// 2026-09-09: FindGymScreen.tsx 머신 탭의 부위/카테고리/브랜드 필터를
// 가로 스크롤 칩 방식에서 바텀시트 방식으로 교체 (사용자가 참고로 준
// 다른 앱의 필터 UI 참고). 3개 필터를 탭으로 묶고, 브랜드는 옵션 수가
// 많아서(로고 매핑만 53개, 실 데이터는 더 많을 수 있음) 검색창 + 알파벳
// 섹션 리스트 + 다중선택(체크박스)으로 구성. 부위/카테고리는 옵션 수가
// 적어 단일선택 리스트로 유지.
//
// 브랜드 로고는 전부 로컬 번들 이미지(require, src/assets/brand-logos/)라
// 네트워크 요청이 없어 목록에 같이 표시해도 로딩 지연이 거의 없음.
//
// 필터링 로직 자체(부위/카테고리/브랜드 옵션 계산, 매칭 개수 계산)는
// FindGymScreen.tsx가 가진 걸 그대로 콜백(getCategoryOptions 등)으로
// 넘겨받아 재사용 — 로직 중복을 피하기 위함.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SectionList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../theme';
import { brandLogos } from '../constants/brandLogos';

type FilterTabKey = 'muscle' | 'category' | 'brand';

const TABS: { key: FilterTabKey; label: string }[] = [
  { key: 'muscle',   label: '부위' },
  { key: 'category', label: '카테고리' },
  { key: 'brand',    label: '브랜드' },
];

interface MachineFilterSheetProps {
  visible:      boolean;
  initialTab:   FilterTabKey;
  onClose:      () => void;
  onApply:      (result: { muscle: string; category: string; brands: Set<string> }) => void;

  muscleOptions:      string[];               // 'All' 포함
  initialMuscle:      string;
  getCategoryOptions: (muscle: string) => string[];
  initialCategory:    string;
  getBrandOptions:    (muscle: string) => string[]; // 'All' 미포함, 순수 브랜드명 목록
  initialBrands:      Set<string>;
  computeCount:       (muscle: string, category: string, brands: Set<string>) => number;
}

function brandLogoFor(name: string) {
  const key = name.toUpperCase().replace(/\s+/g, '_');
  return brandLogos[key];
}

export default function MachineFilterSheet({
  visible,
  initialTab,
  onClose,
  onApply,
  muscleOptions,
  initialMuscle,
  getCategoryOptions,
  initialCategory,
  getBrandOptions,
  initialBrands,
  computeCount,
}: MachineFilterSheetProps) {
  const [activeTab,     setActiveTab]     = useState<FilterTabKey>(initialTab);
  const [draftMuscle,   setDraftMuscle]   = useState(initialMuscle);
  const [draftCategory, setDraftCategory] = useState(initialCategory);
  const [draftBrands,   setDraftBrands]   = useState<Set<string>>(initialBrands);
  const [brandSearch,   setBrandSearch]   = useState('');

  // 시트가 열릴 때마다 마지막으로 "적용"된 값으로 초기화 (이전에 만지다 만
  // 임시 선택은 버림 — 다시 열었을 때 항상 실제 적용 상태부터 시작).
  useEffect(() => {
    if (!visible) return;
    setActiveTab(initialTab);
    setDraftMuscle(initialMuscle);
    setDraftCategory(initialCategory);
    setDraftBrands(new Set(initialBrands));
    setBrandSearch('');
  }, [visible]);

  // 부위가 바뀌면 카테고리/브랜드 옵션도 바뀌므로, 더는 유효하지 않은
  // 선택은 정리한다 (카테고리는 단일값이라 'All'로, 브랜드는 다중선택이라
  // 유효한 것만 남기고 나머지만 제거).
  useEffect(() => {
    const validCategories = getCategoryOptions(draftMuscle);
    setDraftCategory(prev => (prev === 'All' || validCategories.includes(prev)) ? prev : 'All');

    const validBrands = new Set(getBrandOptions(draftMuscle));
    setDraftBrands(prev => {
      const filtered = new Set([...prev].filter(b => validBrands.has(b)));
      return filtered.size === prev.size ? prev : filtered;
    });
    // getCategoryOptions/getBrandOptions는 상위에서 매 렌더 새로 만들어질 수
    // 있어 deps에서 의도적으로 제외 — draftMuscle 변경 시에만 재검증하면 충분.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftMuscle]);

  const categoryOptions = useMemo(() => getCategoryOptions(draftMuscle), [draftMuscle, getCategoryOptions]);

  const brandSections = useMemo(() => {
    const all = getBrandOptions(draftMuscle);
    const kw  = brandSearch.trim().toLowerCase();
    const filtered = kw ? all.filter(b => b.toLowerCase().includes(kw)) : all;
    const sorted = [...filtered].sort((a, b) => a.localeCompare(b));

    const groups: Record<string, string[]> = {};
    for (const b of sorted) {
      const letter = (b[0] ?? '#').toUpperCase();
      (groups[letter] ??= []).push(b);
    }
    return Object.keys(groups)
      .sort()
      .map(letter => ({ title: letter, data: groups[letter] }));
  }, [draftMuscle, brandSearch, getBrandOptions]);

  const resultCount = useMemo(
    () => computeCount(draftMuscle, draftCategory, draftBrands),
    [draftMuscle, draftCategory, draftBrands, computeCount],
  );

  function toggleBrand(name: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftBrands(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function selectMuscle(opt: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDraftMuscle(prev => (prev === opt ? 'All' : opt));
  }

  function selectCategory(opt: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDraftCategory(prev => (prev === opt ? 'All' : opt));
  }

  function handleReset() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDraftMuscle('All');
    setDraftCategory('All');
    setDraftBrands(new Set());
    setBrandSearch('');
  }

  function handleApply() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply({ muscle: draftMuscle, category: draftCategory, brands: draftBrands });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={fs.sheet}>
          <View style={fs.dragHandle} />

          {/* Tab row */}
          <View style={fs.tabRow}>
            {TABS.map(t => {
              const on = t.key === activeTab;
              const badge =
                t.key === 'muscle'   ? (draftMuscle !== 'All' ? 1 : 0) :
                t.key === 'category' ? (draftCategory !== 'All' ? 1 : 0) :
                draftBrands.size;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={fs.tabItem}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(t.key); }}
                  activeOpacity={0.75}
                >
                  <Text style={[fs.tabItemText, on && fs.tabItemTextActive]}>
                    {t.label}{badge > 0 ? ` (${badge})` : ''}
                  </Text>
                  {on && <View style={fs.tabItemUnderline} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={fs.tabDivider} />

          {/* Tab content */}
          <View style={fs.content}>
            {activeTab === 'muscle' && (
              <SectionList
                sections={[{ title: '', data: muscleOptions.filter(o => o !== 'All') }]}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <OptionRow label={item} selected={draftMuscle === item} onPress={() => selectMuscle(item)} />
                )}
                ListHeaderComponent={
                  <OptionRow label="전체" selected={draftMuscle === 'All'} onPress={() => setDraftMuscle('All')} />
                }
                showsVerticalScrollIndicator={false}
              />
            )}

            {activeTab === 'category' && (
              draftMuscle === 'All' ? (
                <View style={fs.emptyWrap}>
                  <Text style={fs.emptyText}>부위를 먼저 선택해주세요</Text>
                </View>
              ) : (
                <SectionList
                  sections={[{ title: '', data: categoryOptions }]}
                  keyExtractor={item => item}
                  renderItem={({ item }) => (
                    <OptionRow label={item} selected={draftCategory === item} onPress={() => selectCategory(item)} />
                  )}
                  ListHeaderComponent={
                    <OptionRow label="전체" selected={draftCategory === 'All'} onPress={() => setDraftCategory('All')} />
                  }
                  showsVerticalScrollIndicator={false}
                />
              )
            )}

            {activeTab === 'brand' && (
              <>
                <View style={fs.searchWrap}>
                  <Ionicons name="search-outline" size={15} color={C.textSub} style={{ marginRight: 6 }} />
                  <TextInput
                    style={fs.searchInput}
                    placeholder="브랜드를 검색하세요"
                    placeholderTextColor={C.textDim}
                    value={brandSearch}
                    onChangeText={setBrandSearch}
                    autoCorrect={false}
                    selectionColor={C.accent}
                  />
                  {brandSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setBrandSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={16} color={C.textDim} />
                    </TouchableOpacity>
                  )}
                </View>

                <SectionList
                  sections={brandSections}
                  keyExtractor={item => item}
                  renderSectionHeader={({ section }) => (
                    <Text style={fs.sectionHeader}>{section.title}</Text>
                  )}
                  renderItem={({ item }) => (
                    <BrandRow
                      name={item}
                      logo={brandLogoFor(item)}
                      selected={draftBrands.has(item)}
                      onPress={() => toggleBrand(item)}
                    />
                  )}
                  ListEmptyComponent={
                    <View style={fs.emptyWrap}>
                      <Text style={fs.emptyText}>일치하는 브랜드가 없어요</Text>
                    </View>
                  }
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  stickySectionHeadersEnabled
                />
              </>
            )}
          </View>

          {/* Bottom actions */}
          <View style={fs.actionRow}>
            <TouchableOpacity style={fs.resetBtn} onPress={handleReset} activeOpacity={0.75}>
              <Text style={fs.resetBtnText}>초기화</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fs.applyBtn} onPress={handleApply} activeOpacity={0.85}>
              <Text style={fs.applyBtnText}>{resultCount.toLocaleString()}개 머신보기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// --- Row components

function OptionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={fs.optionRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[fs.optionRowText, selected && fs.optionRowTextActive]}>{label}</Text>
      {selected && <Ionicons name="checkmark" size={18} color={C.accent} />}
    </TouchableOpacity>
  );
}

function BrandRow({ name, logo, selected, onPress }: { name: string; logo?: number; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={fs.brandRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons
        name={selected ? 'checkbox' : 'square-outline'}
        size={20}
        color={selected ? C.accent : C.textDim}
        style={{ marginRight: 10 }}
      />
      <View style={fs.brandLogoBox}>
        {logo ? (
          <Image source={logo} style={{ width: 26, height: 26 }} resizeMode="contain" />
        ) : (
          <Text style={fs.brandLogoFallback}>{name[0]?.toUpperCase()}</Text>
        )}
      </View>
      <Text style={[fs.brandRowText, selected && fs.optionRowTextActive]} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
}

// --- Styles

const fs = StyleSheet.create({
  sheet: {
    height: '78%',
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 6,
  },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabItemText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  tabItemTextActive: { color: C.text, fontWeight: '800' },
  tabItemUnderline: { marginTop: 8, height: 2, width: 24, backgroundColor: C.text, borderRadius: 1 },
  tabDivider: { height: 1, backgroundColor: C.border },

  content: { flex: 1 },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.borderSub,
  },
  optionRowText: { fontSize: 15, color: C.text },
  optionRowTextActive: { color: C.accent, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.inner,
    marginHorizontal: 16, marginTop: 10, marginBottom: 6,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  sectionHeader: {
    fontSize: 12, fontWeight: '800', color: C.textSub,
    backgroundColor: C.bg,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6,
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  brandLogoBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  brandLogoFallback: { fontSize: 12, fontWeight: '800', color: C.textDim },
  brandRowText: { flex: 1, fontSize: 14, color: C.text },

  emptyWrap: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: C.textDim },

  actionRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  resetBtn: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: R.btn, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  resetBtnText: { fontSize: 14, fontWeight: '700', color: C.textSub },
  applyBtn: {
    flex: 1, paddingVertical: 14, borderRadius: R.btn,
    backgroundColor: C.text, alignItems: 'center', justifyContent: 'center',
  },
  applyBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },
});
