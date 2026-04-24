import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = 8;
const CARD_W   = (SCREEN_W - 32 - GRID_GAP) / 2;  // 16px h-padding each side
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, R, T } from '../theme';
import { fetchMachines, fetchGymsWithMachines } from '../lib/db';
import { useFetch } from '../lib/useFetch';
import { MachineWithGyms, GymWithMachines } from '../data/types';
import { getRankingByMuscle, getLastUpdatedAt } from '../data/machineRankingStore';
import MachineRankingCard from '../components/MachineRankingCard';
import { FAVORITE_MACHINES } from '../data/machineReviews';
import { getGymFavorites } from '../data/gymFavoriteStore';
import { getAllAdminGyms } from '../data/adminGymStore';
import GymDetailModal     from './flow/GymDetailModal';
import MachineDetailModal from './flow/MachineDetailModal';
import MachineCard        from '../components/MachineCard';
import MachineCardBorder  from '../components/MachineCardBorder';
import OlympicNavigator   from './olympic/OlympicNavigator';

// --- Mock distances

const MOCK_DIST: Record<string, { dist: string; distNum: number; open: boolean }> = {
  g01: { dist: '0.3 km', distNum: 0.3, open: true  },
  g02: { dist: '0.9 km', distNum: 0.9, open: true  },
  g03: { dist: '1.1 km', distNum: 1.1, open: true  },
  g04: { dist: '1.4 km', distNum: 1.4, open: false },
  g05: { dist: '2.0 km', distNum: 2.0, open: true  },
  g06: { dist: '2.3 km', distNum: 2.3, open: false },
  g07: { dist: '3.1 km', distNum: 3.1, open: true  },
  g08: { dist: '4.5 km', distNum: 4.5, open: true  },
};

function getDist(id: string) {
  return MOCK_DIST[id] ?? { dist: '-- km', distNum: 99, open: true };
}

// --- Muscle colour palette

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:          C.tagMachine,
  Back:           C.tagBrand,
  Legs:           C.tagMuscle,
  Shoulders:      { fg: '#ffd166', bg: '#ffd16618' },
  Arms:           C.tagCategory,
  Core:           { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body':    { fg: '#a8dadc', bg: '#a8dadc18' },
  Glutes:         { fg: '#ff9ecd', bg: '#ff9ecd18' },
  'HIP (Glutes)': { fg: '#ff9ecd', bg: '#ff9ecd18' },
  Other:          { fg: '#aaaaaa', bg: '#aaaaaa18' },
};

function mpStyle(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

// muscleOptions is built dynamically inside the component from actual data

// --- Filter chip row

function FilterRow({
  sectionLabel,
  options,
  active,
  onSelect,
  activeColor,
}: {
  sectionLabel: string;
  options:      string[];
  active:       string;
  onSelect:     (v: string) => void;
  activeColor:  string;
}) {
  return (
    <View>
      <Text style={s.filterLabel}>{sectionLabel}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
      >
        {options.map(opt => {
          const on = opt === active;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                s.filterChip,
                on && { backgroundColor: activeColor, borderColor: activeColor },
              ]}
              onPress={() => onSelect(on ? 'All' : opt)}
              activeOpacity={0.75}
            >
              <Text style={[s.filterChipText, on && { color: C.bg }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// --- Section heading

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.countPill}>
        <Text style={s.countPillText}>{count}</Text>
      </View>
    </View>
  );
}

// --- Gym card

function GymCard({
  gym,
  matchCount,
  onPress,
}: {
  gym:        GymWithMachines;
  matchCount: number;
  onPress:    () => void;
}) {
  const meta = getDist(gym.id);
  return (
    <TouchableOpacity style={s.gymCard} activeOpacity={0.8} onPress={onPress}>
      <View style={{ flex: 1, paddingLeft: 0 }}>
        <View style={s.gymCardTop}>
          <Text style={s.gymCardName}>{gym.name}</Text>
          <View style={[s.openBadge, { backgroundColor: meta.open ? C.accentBg : C.border }]}>
            <Text style={[s.openBadgeText, { color: meta.open ? C.accent : C.textSub }]}>
              {meta.open ? '영업 중' : '영업 종료'}
            </Text>
          </View>
        </View>
        <View style={s.gymCardMeta}>
          <Ionicons name="location-outline" size={11} color={C.textSub} />
          <Text style={s.gymCardLoc}>{gym.location}</Text>
        </View>
        <View style={s.gymCardFooter}>
          <View style={s.distBadge}>
            <Ionicons name="navigate-outline" size={10} color={C.accent} />
            <Text style={s.distText}>{meta.dist}</Text>
          </View>
          <Text style={s.gymMatchText}>
            {matchCount} 머신
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// --- Empty state

function EmptyRow({ label }: { label: string }) {
  return (
    <View style={s.emptyRow}>
      <Text style={s.emptyRowText}>{label}</Text>
    </View>
  );
}

// --- Memoized machine card item

const MachineItem = React.memo(({
  machine,
  cardWidth,
  onPress,
  isFavorite,
}: {
  machine: MachineWithGyms;
  cardWidth: number;
  onPress: (machine: MachineWithGyms) => void;
  isFavorite?: boolean;
}) => (
  <TouchableOpacity
    style={{ width: cardWidth, position: 'relative' }}
    onPress={() => onPress(machine)}
    activeOpacity={0.8}
  >
    <MachineCardBorder>
      <MachineCard machine={machine} variant="grid" width={cardWidth} />
    </MachineCardBorder>
    {isFavorite && (
      <View style={s.favOverlay}>
        <Ionicons name="heart" size={18} color="#ff4d6d" />
      </View>
    )}
  </TouchableOpacity>
));

// --- Screen

const RANKING_MUSCLES = ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'GLUTES'];

export default function FindGymScreen() {
  const nav = useNavigation<any>();
  const flatListRef = useRef<FlatList<MachineWithGyms>>(null);
  const [keyword,          setKeyword]          = useState('');
  const [activeMuscle,     setActiveMuscle]     = useState('All');
  const [rankingMuscle,    setRankingMuscle]    = useState('CHEST');
  const [activeBrand,      setActiveBrand]      = useState('All');
  const [detailMachine,    setDetailMachine]    = useState<MachineWithGyms | null>(null);
  const [gymDetailId,      setGymDetailId]      = useState<string | null>(null);
  const [gymDetailVisible, setGymDetailVisible] = useState(false);
  const [favorites,         setFavorites]         = useState<Set<string>>(
    () => new Set(FAVORITE_MACHINES.map(f => f.machineId))
  );
  const [activeTab,         setActiveTab]         = useState<'machine' | 'gym' | 'favorite'>('machine');
  const [gymFavoriteIds] = useState<string[]>(() => getGymFavorites());
  const [olympicVisible,    setOlympicVisible]    = useState(false);

  // --- Supabase data - falls back to mock automatically
  const { data: machinesData, loading: machinesLoading } = useFetch(() => fetchMachines(),         []);
  const { data: gymsData,     loading: gymsLoading }     = useFetch(() => fetchGymsWithMachines(), []);

  const isLoading   = machinesLoading || gymsLoading;
  const allMachines = machinesData ?? [];
  console.log('[DEBUG] FindGym machines[0]:', allMachines?.[0]?.id, allMachines?.[0]?.imageUrl);

  const allGyms = useMemo<GymWithMachines[]>(() => {
    const base = gymsData ?? [];
    const adminGyms = getAllAdminGyms().map(ag => {
      const machines: MachineWithGyms[] = ag.machineIds
        .map(id => allMachines.find(m => m.id === id))
        .filter((m): m is MachineWithGyms => !!m);
      return {
        id: ag.id,
        name: ag.name,
        location: ag.location,
        description: ag.phone ? `${ag.phone}${ag.hours ? '  |  ' + ag.hours : ''}` : (ag.hours ?? ''),
        machines,
        machineIds: ag.machineIds,
      } as GymWithMachines;
    });
    return [...base, ...adminGyms];
  }, [gymsData, allMachines]);
  // --- Derived filter options

  // Muscle chips built dynamically from actual machine data — always matches what's in the DB
  const muscleOptions = useMemo(() => {
    const unique = [...new Set(
      allMachines.map(m => m.targetMuscle).filter(Boolean)
    )].sort();
    return ['All', ...unique];
  }, [allMachines]);

  const brands = useMemo(() => {
    const sourceMachines = activeMuscle === 'All'
      ? allMachines
      : allMachines.filter(m =>
          m.targetMuscle?.toLowerCase() === activeMuscle.toLowerCase()
        );
    const uniqueBrands = [...new Set(sourceMachines.map(m => m.brand))].sort();
    return ['All', ...uniqueBrands];
  }, [allMachines, activeMuscle]);

  useEffect(() => {
    if (activeBrand === 'All') return;
    const stillValid = brands.some(b => b.toLowerCase() === activeBrand.toLowerCase());
    if (!stillValid) setActiveBrand('All');
  }, [brands, activeBrand]);

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const hasFilters =
    keyword.trim().length > 0 || activeMuscle !== 'All' || activeBrand !== 'All';

  function clearAll() {
    setKeyword('');
    setActiveMuscle('All');
    setActiveBrand('All');
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  // --- Filtered machines
  const filteredMachines = useMemo(() => {
    return allMachines.filter(m => {
      const muscleOk = activeMuscle === 'All' || m.targetMuscle?.toLowerCase() === activeMuscle.toLowerCase();
      const brandOk  = activeBrand  === 'All' || m.brand?.toLowerCase()         === activeBrand.toLowerCase();
      const kw       = keyword.trim().toLowerCase();
      const keyOk    = !kw ||
        m.name.toLowerCase().includes(kw) ||
        m.category.toLowerCase().includes(kw);
      return muscleOk && brandOk && keyOk;
    });
  }, [keyword, activeMuscle, activeBrand, allMachines]);

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filteredMachines]);

  // --- Filtered gyms for gym tab (by keyword / gym name)
  const filteredGymsForTab = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allGyms
      .filter(gym => !kw || gym.name.toLowerCase().includes(kw))
      .sort((a, b) => getDist(a.id).distNum - getDist(b.id).distNum);
  }, [allGyms, keyword]);

  const favTabMachines = useMemo(
    () => allMachines.filter(m => favorites.has(m.id)),
    [allMachines, favorites],
  );

  // --- Render

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Fixed header + filters */}
      <View>
        {/* Title row */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>머신 · 헬스장 찾기</Text>
            <Text style={s.headerSub}>머신, 부위, 브랜드로 검색하세요</Text>
          </View>
          {hasFilters && activeTab === 'machine' && (
            <TouchableOpacity style={s.clearBtn} onPress={clearAll} activeOpacity={0.75}>
              <Text style={s.clearBtnText}>초기화</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Keyword search */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.textSub} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder={activeTab === 'machine' ? '머신 이름으로 검색' : '헬스장 이름으로 검색'}
            placeholderTextColor={C.textDim}
            value={keyword}
            onChangeText={setKeyword}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={C.accent}
          />
          {keyword.length > 0 && (
            <TouchableOpacity
              onPress={() => setKeyword('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={16} color={C.textDim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab buttons */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'machine' && s.tabBtnActive]}
            onPress={() => setActiveTab('machine')}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'machine' && s.tabBtnTextActive]}>머신</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'gym' && s.tabBtnActive]}
            onPress={() => setActiveTab('gym')}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'gym' && s.tabBtnTextActive]}>헬스장</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'favorite' && s.tabBtnActive]}
            onPress={() => setActiveTab('favorite')}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'favorite' && s.tabBtnTextActive]}>즐겨찾기</Text>
          </TouchableOpacity>
        </View>

        {/* Machine tab filters */}
        {activeTab === 'machine' && (
          <>
            {/* Muscle filter */}
            <View>
              <Text style={s.filterLabel}>타겟 부위</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filterRow}
              >
                {muscleOptions.map(opt => {
                  const on = opt === activeMuscle;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        s.filterChip,
                        on && { backgroundColor: C.tagMuscle.fg, borderColor: C.tagMuscle.fg },
                      ]}
                      onPress={() => setActiveMuscle(on ? 'All' : opt)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.filterChipText, on && { color: C.bg }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Brand filter */}
            <FilterRow
              sectionLabel="브랜드"
              options={brands}
              active={activeBrand}
              onSelect={setActiveBrand}
              activeColor={C.tagBrand.fg}
            />

            {hasFilters && (
              <View style={s.filterSummaryRow}>
                <Ionicons name="options-outline" size={13} color={C.accent} />
                <Text style={s.filterSummaryText}>
                  {[
                    activeMuscle !== 'All' && activeMuscle,
                    activeBrand  !== 'All' && activeBrand,
                    keyword.trim() && `"${keyword.trim()}"`,
                  ].filter(Boolean).join(' + ')}
                </Text>
                <Text style={s.filterSummaryCount}>{filteredMachines.length}개</Text>
              </View>
            )}
          </>
        )}

        <View style={s.dividerLine} />
      </View>

      {/* Machine tab — virtualized FlatList */}
      {activeTab === 'machine' && (
        <FlatList
          ref={flatListRef}
          data={filteredMachines}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GRID_GAP }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.results}
          renderItem={({ item: machine }) => (
            <MachineItem
              machine={machine}
              cardWidth={CARD_W}
              onPress={setDetailMachine}
              isFavorite={favorites.has(machine.id)}
            />
          )}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyRow label="조건에 맞는 머신이 없어요." />
            ) : (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={C.accent} />
              </View>
            )
          }
          ListHeaderComponent={
            <View>
              {isLoading && (
                <View style={s.loadingRow}>
                  <Text style={s.loadingText}>로딩 중...</Text>
                </View>
              )}

              {/* ── 인기 머신 랭킹 ── */}
              {!hasFilters && (
                <View style={s.rankingSection}>
                  {/* Section header */}
                  <View style={s.rankingSectionRow}>
                    <Text style={s.rankingSectionTitle}>이번 주 인기 머신 🔥</Text>
                    <TouchableOpacity onPress={() => nav.navigate('MachineRanking')} activeOpacity={0.75}>
                      <Text style={s.rankingSeeAll}>더보기</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Muscle selector chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.rankingChipRow}
                  >
                    {RANKING_MUSCLES.map(muscle => {
                      const active = muscle === rankingMuscle;
                      return (
                        <TouchableOpacity
                          key={muscle}
                          style={[s.rankingChip, active && s.rankingChipActive]}
                          onPress={() => setRankingMuscle(muscle)}
                          activeOpacity={0.75}
                        >
                          <Text style={[s.rankingChipText, active && s.rankingChipTextActive]}>
                            {muscle}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Ranking cards */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.rankingCardRow}
                  >
                    {getRankingByMuscle(rankingMuscle).map(entry => (
                      <MachineRankingCard
                        key={entry.machineId}
                        entry={entry}
                        onPress={() => nav.navigate('MachineRanking')}
                      />
                    ))}
                  </ScrollView>

                  {/* Last updated */}
                  <Text style={s.rankingUpdatedText}>
                    1시간마다 업데이트 · 최근 갱신: {getLastUpdatedAt()}
                  </Text>
                </View>
              )}

              {!isLoading && !hasFilters && (
                <TouchableOpacity
                  style={s.olympicBanner}
                  activeOpacity={0.85}
                  onPress={() => setOlympicVisible(true)}
                >
                  <Ionicons name="trophy" size={28} color={C.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.olympicTitle}>머신 올림픽</Text>
                    <Text style={s.olympicSub}>내가 가장 좋아하는 머신은?</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.textDim} />
                </TouchableOpacity>
              )}
              {!isLoading && (
                <SectionHead
                  title={hasFilters ? '검색 결과' : '머신'}
                  count={filteredMachines.length}
                />
              )}
            </View>
          }
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      )}

      {/* Gym tab — ScrollView */}
      {activeTab === 'gym' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.results, { paddingTop: 16 }]}
        >
          {isLoading && (
            <View style={s.loadingRow}>
              <Text style={s.loadingText}>로딩 중...</Text>
            </View>
          )}
          {!isLoading && (
            <SectionHead title="헬스장" count={filteredGymsForTab.length} />
          )}
          {!isLoading && (filteredGymsForTab.length === 0 ? (
            <EmptyRow label="헬스장을 찾을 수 없어요." />
          ) : (
            filteredGymsForTab.map(gym => (
              <GymCard
                key={gym.id}
                gym={gym}
                matchCount={gym.machines.length}
                onPress={() => {
                  setGymDetailId(gym.id);
                  setGymDetailVisible(true);
                }}
              />
            ))
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Favorites tab — FlatList */}
      {activeTab === 'favorite' && (
        <FlatList
          data={favTabMachines}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GRID_GAP }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.results, { paddingTop: 16 }]}
          renderItem={({ item: machine }) => (
            <MachineItem
              machine={machine}
              cardWidth={CARD_W}
              onPress={setDetailMachine}
              isFavorite={true}
            />
          )}
          ListHeaderComponent={
            <View>
              {/* Favorite gyms */}
              <SectionHead title="즐겨찾기 헬스장" count={gymFavoriteIds.length} />
              {gymFavoriteIds.length === 0 ? (
                <EmptyRow label="즐겨찾기한 항목이 없습니다." />
              ) : (
                gymFavoriteIds
                  .map(id => allGyms.find(g => g.id === id))
                  .filter((g): g is GymWithMachines => !!g)
                  .map(gym => (
                    <GymCard
                      key={gym.id}
                      gym={gym}
                      matchCount={gym.machines.length}
                      onPress={() => {
                        setGymDetailId(gym.id);
                        setGymDetailVisible(true);
                      }}
                    />
                  ))
              )}
              <View style={s.sectionDivider} />
              <SectionHead title="즐겨찾기 머신" count={favTabMachines.length} />
              {favTabMachines.length === 0 && (
                <EmptyRow label="즐겨찾기한 항목이 없습니다." />
              )}
            </View>
          }
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      )}

      {/* Modals */}
      <MachineDetailModal
        visible={detailMachine !== null}
        machine={detailMachine}
        onClose={() => setDetailMachine(null)}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />

      <GymDetailModal
        visible={gymDetailVisible}
        gymId={gymDetailId}
        onClose={() => setGymDetailVisible(false)}
      />

      <OlympicNavigator
        visible={olympicVisible}
        onClose={() => setOlympicVisible(false)}
      />
    </SafeAreaView>
  );
}

// --- Styles

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    paddingHorizontal: 16,
    paddingTop:     24,
    paddingBottom:  16,
  },
  headerTitle: { ...T.title, color: C.text },
  headerSub:   { fontSize: 13, color: C.textSub, marginTop: 3 },
  clearBtn:    {
    marginTop: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: C.accent },

  // Search
  searchWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: C.surface,
    borderRadius:   R.inner,
    marginHorizontal: 16,
    marginBottom:   8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  // Filters
  filterLabel: {
    fontSize: 9, fontWeight: '700', color: C.textDim,
    letterSpacing: 1.2, textTransform: 'uppercase',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  filterRow:      { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  filterChip:     {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    minHeight:         40,
    justifyContent:    'center',
    alignItems:        'center',
  },
  filterChipText: { fontSize: 14, fontWeight: '600', color: C.textSub },

  filterSummaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: C.accentBg,
    marginBottom: 4,
  },
  filterSummaryText:  { flex: 1, fontSize: 12, fontWeight: '600', color: C.accent },
  filterSummaryCount: { fontSize: 12, fontWeight: '800', color: C.accent },

  dividerLine:    { height: 1, backgroundColor: C.border, marginTop: 8 },
  sectionDivider: { height: 1, backgroundColor: C.border, marginVertical: 24 },

  // Results
  results: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  sectionHead:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: C.text },
  countPill:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill, backgroundColor: C.surface },
  countPillText: { fontSize: 12, fontWeight: '700', color: C.textSub },

  loadingRow:   { paddingVertical: 48, alignItems: 'center' },
  loadingText:  { fontSize: 13, color: C.textDim },
  loadMoreRow:  { paddingVertical: 16, alignItems: 'center' },

  emptyRow:     { paddingVertical: 18, alignItems: 'center', marginBottom: 16 },
  emptyRowText: { fontSize: 13, color: C.textDim },

  // Olympic banner
  olympicBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surfaceHigh,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 16,
  },
  olympicTitle: { fontSize: 16, fontWeight: '900', color: C.text },
  olympicSub:   { fontSize: 12, color: C.textSub, marginTop: 3 },

  // Tab buttons
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.surface,
  },
  tabBtnActive: {
    backgroundColor: C.accent,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSub,
  },
  tabBtnTextActive: {
    color: C.bg,
  },

  // Favorites filter toggle chip
  favChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  favChipActive: { backgroundColor: '#ff4d6d18' },
  favChipActiveText: { color: '#ff4d6d' },

  // Shared MachineCard wrapper — 2-column grid
  machineGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: GRID_GAP, marginBottom: 16,
  },
  favOverlay: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(10, 10, 12, 0.72)',
    borderRadius: R.pill, padding: 6,
  },
  musclePill:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill },
  musclePillText: { fontSize: 11, fontWeight: '700' },

  // Gym card
  gymCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: C.surface, borderRadius: R.card,
    marginBottom: 8, overflow: 'hidden',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  gymCardTop:    { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  gymCardName:   { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  gymCardMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  gymCardLoc:    { fontSize: 12, color: C.textSub },
  gymCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  openBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.pill },
  openBadgeText: { fontSize: 10, fontWeight: '700' },
  distBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accentBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  distText:      { fontSize: 11, fontWeight: '700', color: C.accent },
  gymMatchText:  { fontSize: 12, color: C.textSub },

  // ── Ranking section ──────────────────────────────────────────────────────
  rankingSection: {
    marginBottom: 8,
  },
  rankingSectionRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    10,
  },
  rankingSectionTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      C.text,
  },
  rankingSeeAll: {
    fontSize:   13,
    fontWeight: '700',
    color:      C.accent,
  },
  rankingChipRow: {
    gap:          8,
    paddingBottom: 10,
  },
  rankingChip: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
  },
  rankingChipActive: {
    backgroundColor: C.accent,
    borderColor:     C.accent,
  },
  rankingChipText: {
    fontSize:   12,
    fontWeight: '700',
    color:      C.textSub,
  },
  rankingChipTextActive: {
    color: C.bg,
  },
  rankingCardRow: {
    gap:          10,
    paddingBottom: 4,
  },
  rankingUpdatedText: {
    fontSize:   10,
    color:      C.textDim,
    marginTop:  8,
    marginBottom: 16,
  },
});
