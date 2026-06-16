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
  StatusBar,
  Dimensions,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { brandLogos } from '../constants/brandLogos';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = 8;
const CARD_W   = (SCREEN_W - 32 - GRID_GAP) / 2;  // 16px h-padding each side
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import GymMapView from '../components/GymMapView';
import { C, R, T } from '../theme';
import { useAuth } from '../context/AuthContext';
import { submitGymRegistrationRequest } from '../lib/db/gymRegistrationRequests';
import { fetchMachines, fetchGymsWithMachines, getGymsCacheSync, getMachinesCacheSync } from '../lib/db';
import { MachineWithGyms, GymWithMachines } from '../data/types';
import { fetchRankingTabData, type RankingTabData } from '../lib/db/rankingQueries';
import { fetchOlympicRankings, type OlympicRankingEntry } from '../lib/db/olympicRankings';
import { RankingTab } from './FindGymRankingTab';
import { getGymFavorites } from '../data/gymFavoriteStore';
import { getAllAdminGyms } from '../data/adminGymStore';
import GymDetailModal     from './flow/GymDetailModal';
import MachineDetailModal from './flow/MachineDetailModal';
import MachineCard        from '../components/MachineCard';
import MachineCardBorder  from '../components/MachineCardBorder';

import * as Location from 'expo-location';
import { calcDistanceKm, formatDistance } from '../lib/geocoding';
import FavoriteGymRecommendation from '../components/FavoriteGymRecommendation';
import { toEnMuscle } from '../lib/splitUtils';
import * as Haptics from 'expo-haptics';

const CATEGORY_ORDER: Record<string, string[]> = {
  Chest: [
    'Chest Press', 'Incline Press', 'Decline Press',
    'Fly', 'Incline Fly', 'Chest_Etc',
  ],
  Back: [
    'Pull Down', 'High Row', 'Middle Row', 'Low Row',
    'T-Bar', 'Pullover', 'Chin Dip', 'Back_Etc',
  ],
  Leg: [
    'Leg Press', 'Hack Squat', 'Pendulum Squat', 'Squat Machine',
    'Leg Curl', 'Leg Extention', 'Calf', 'Viking Press', 'Leg_Etc',
  ],
  Shoulder: [
    'Shoulder Press', 'Raise_Side Lateral', 'Rear Delt',
    'Rear Delt / Pec Fly', 'Shoulder_Etc',
  ],
  Arms: [
    'Biceps', 'Triceps', 'Arm_Etc',
  ],
  'Hip (Glutes)': [
    'Hip Press', 'Hip Thrust', 'Hip Abduction', 'Inner Outer', 'Glute_Etc',
  ],
  Other: [
    'Free Weight', 'Etc',
  ],
};

// --- Muscle colour palette

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:          C.tagMachine,
  Back:           C.tagBrand,
  Leg:           C.tagMuscle,
  Shoulder:      { fg: '#ffd166', bg: '#ffd16618' },
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
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(on ? 'All' : opt); }}
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
  distLabel,
  onPress,
}: {
  gym:        GymWithMachines;
  matchCount: number;
  distLabel:  string;
  onPress:    () => void;
}) {
  return (
    <TouchableOpacity style={s.gymCard} activeOpacity={0.8} onPress={onPress}>
      <View style={{ flex: 1, paddingLeft: 0 }}>
        <View style={s.gymCardTop}>
          <Text style={s.gymCardName}>{gym.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {gym.managerId && (
              <Ionicons
                name="shield-checkmark"
                size={15}
                color="#5ba4ff"
              />
            )}
            <View style={[s.openBadge, { backgroundColor: C.accentBg }]}>
              <Text style={[s.openBadgeText, { color: C.accent }]}>영업 중</Text>
            </View>
          </View>
        </View>
        <View style={s.gymCardMeta}>
          <Ionicons name="location-outline" size={11} color={C.textSub} />
          <Text style={s.gymCardLoc}>{gym.location}</Text>
        </View>
        <View style={s.gymCardFooter}>
          {distLabel ? (
            <View style={s.distBadge}>
              <Ionicons name="navigate-outline" size={10} color={C.accent} />
              <Text style={s.distText}>{distLabel}</Text>
            </View>
          ) : null}
          <Text style={s.gymMatchText}>
            {matchCount} 머신
          </Text>
        </View>
        {/* 오피셜 브랜드 로고 */}
        {gym.officialBrands && gym.officialBrands.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {gym.officialBrands.map(brand => {
              const key = brand.toUpperCase().replace(/\s+/g, '_');
              const logo = brandLogos[key];
              return logo ? (
                <View key={brand} style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 }}>
                  <Image
                    source={logo}
                    style={{ width: 36, height: 14 }}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <Text key={brand} style={{ fontSize: 9, fontWeight: '700', color: '#5ba4ff' }}>
                  {brand}
                </Text>
              );
            })}
          </View>
        )}
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

export default function FindGymScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList<MachineWithGyms>>(null);
  const [keyword,          setKeyword]          = useState('');
  const [activeMuscle,     setActiveMuscle]     = useState('All');
  const [activeBrand,      setActiveBrand]      = useState('All');
  const [activeCategory,   setActiveCategory]   = useState('All');
  const [detailMachine,    setDetailMachine]    = useState<MachineWithGyms | null>(null);
  const [gymDetailId,      setGymDetailId]      = useState<string | null>(null);
  const [gymDetailVisible, setGymDetailVisible] = useState(false);
  const [favorites,         setFavorites]         = useState<Set<string>>(new Set());
  const [activeTab,         setActiveTab]         = useState<'machine' | 'gym' | 'favorite' | 'ranking'>('machine');
  const [gymFavoriteIds, setGymFavoriteIds] = useState<string[]>(() => getGymFavorites());

  useEffect(() => {
    setGymFavoriteIds(getGymFavorites());
  }, [user?.id]);

  const [showGymRequestModal, setShowGymRequestModal] = useState(false);
  const [reqGymName,   setReqGymName]   = useState('');
  const [reqLocation,  setReqLocation]  = useState('');
  const [reqNotes,     setReqNotes]     = useState('');
  const [reqLoading,   setReqLoading]   = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gymViewMode,   setGymViewMode]   = useState<'list' | 'map'>('list');
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);

  const [rankingData,    setRankingData]    = useState<RankingTabData | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [olympicRankings, setOlympicRankings] = useState<OlympicRankingEntry[]>([]);
  const [olympicLoading,  setOlympicLoading]  = useState(false);

  const route = useRoute<any>();

  useEffect(() => {
    if (route.params?.initialTab === 'gym' && route.params?.viewMode === 'map') {
      setActiveTab('gym');
      setGymViewMode('map');
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'ranking') return;
    if (rankingData) return;
    setRankingLoading(true);
    fetchRankingTabData()
      .then(data => setRankingData(data))
      .catch(() => setRankingData(null))
      .finally(() => setRankingLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'ranking') return;
    if (olympicRankings.length > 0) return;
    setOlympicLoading(true);
    fetchOlympicRankings()
      .then(setOlympicRankings)
      .finally(() => setOlympicLoading(false));
  }, [activeTab]);

  // GPS 위치 요청
  useEffect(() => {
    async function loadLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {}
    }
    loadLocation();
  }, []);

  // --- Supabase data - falls back to mock automatically
  const [machinesData,    setMachinesData]    = useState<MachineWithGyms[]>(() => getMachinesCacheSync());
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [gymsData,        setGymsData]        = useState<GymWithMachines[]>(() => getGymsCacheSync());
  const [gymsLoading,     setGymsLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMachines().then(data => {
      if (!cancelled) { setMachinesData(data); setMachinesLoading(false); }
    }).catch(() => {
      if (!cancelled) setMachinesLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchGymsWithMachines().then(data => {
      if (!cancelled) { setGymsData(data); setGymsLoading(false); }
    }).catch(() => {
      if (!cancelled) setGymsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const isLoading   = machinesLoading || gymsLoading;
  const allMachines = machinesData ?? [];

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
  const MUSCLE_ORDER = ['Chest', 'Back', 'Leg', 'Shoulder', 'Arms', 'Glutes', 'Other'];

  const muscleOptions = useMemo(() => {
    const unique = [...new Set(
      allMachines.map(m => m.targetMuscle).filter(Boolean)
    )];
    const ordered = MUSCLE_ORDER.filter(m => unique.includes(m));
    const rest = unique.filter(m => !MUSCLE_ORDER.includes(m)).sort();
    return ['All', ...ordered, ...rest];
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

  const categories = useMemo(() => {
    if (activeMuscle === 'All') return [];

    const muscleFiltered = allMachines.filter(m =>
      m.targetMuscle?.toLowerCase() === activeMuscle.toLowerCase()
    );

    const available = new Set(
      muscleFiltered.flatMap(m =>
        m.category
          ? m.category.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
          : []
      )
    );

    const muscleEn    = toEnMuscle(activeMuscle) || activeMuscle;
    const orderedList = CATEGORY_ORDER[muscleEn] ?? [];

    const ordered   = orderedList.filter(cat => available.has(cat));

    const remaining = [...available]
      .filter(cat => !orderedList.includes(cat))
      .sort();

    return [...ordered, ...remaining];
  }, [allMachines, activeMuscle]);

  useEffect(() => {
    if (activeBrand === 'All') return;
    const stillValid = brands.some(b => b.toLowerCase() === activeBrand.toLowerCase());
    if (!stillValid) setActiveBrand('All');
  }, [brands, activeBrand]);

  useEffect(() => {
    setActiveCategory('All');
  }, [activeMuscle]);

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const hasFilters =
    keyword.trim().length > 0 || activeMuscle !== 'All' || activeBrand !== 'All' || activeCategory !== 'All';

  function clearAll() {
    setKeyword('');
    setActiveMuscle('All');
    setActiveBrand('All');
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  async function handleSubmitGymRequest() {
    if (!reqGymName.trim() || !reqLocation.trim()) {
      Alert.alert('입력 오류', '헬스장명과 위치를 입력해주세요.');
      return;
    }
    if (!user) {
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    setReqLoading(true);
    const { error } = await submitGymRegistrationRequest(
      user.id,
      reqGymName.trim(),
      reqLocation.trim(),
      '',
      reqNotes.trim(),
    );
    setReqLoading(false);
    if (error) {
      Alert.alert('오류', error);
      return;
    }
    Alert.alert('신청 완료', '헬스장 등록 요청이 접수되었습니다.\n검토 후 등록해드리겠습니다.');
    setShowGymRequestModal(false);
    setReqGymName('');
    setReqLocation('');
    setReqNotes('');
  }

  // --- Filtered machines
  const filteredMachines = useMemo(() => {
    return allMachines.filter(m => {
      const muscleOk   = activeMuscle === 'All' || m.targetMuscle?.toLowerCase() === activeMuscle.toLowerCase();
      const brandOk    = activeBrand  === 'All' || m.brand?.toLowerCase()         === activeBrand.toLowerCase();
      const categoryOk = activeCategory === 'All' ||
        m.category?.split(',').map(c => c.trim()).includes(activeCategory);
      const kw         = keyword.trim().toLowerCase();
      const keyOk      = !kw ||
        m.name.toLowerCase().includes(kw)     ||
        m.category.toLowerCase().includes(kw) ||
        m.brand?.toLowerCase().includes(kw);
      return muscleOk && brandOk && categoryOk && keyOk;
    });
  }, [keyword, activeMuscle, activeBrand, activeCategory, allMachines]);

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filteredMachines]);

  // --- Filtered gyms for gym tab (by keyword / gym name)
  const filteredGymsForTab = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allGyms
      .filter(gym => !kw || gym.name.toLowerCase().includes(kw))
      .sort((a, b) => {
        if (!userLocation) return 0;
        const distA = (a.latitude != null && a.longitude != null)
          ? calcDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude)
          : 9999;
        const distB = (b.latitude != null && b.longitude != null)
          ? calcDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
          : 9999;
        return distA - distB;
      });
  }, [allGyms, keyword, userLocation]);

  function getDistLabel(gym: GymWithMachines): string {
    if (!userLocation || gym.latitude == null || gym.longitude == null) return '';
    const km = calcDistanceKm(userLocation.latitude, userLocation.longitude, gym.latitude, gym.longitude);
    return formatDistance(km);
  }

  const favTabMachines = useMemo(
    () => allMachines.filter(m => favorites.has(m.id)),
    [allMachines, favorites],
  );

  // --- Render

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
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

        {/* Tab buttons */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'machine' && s.tabBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab('machine'); }}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'machine' && s.tabBtnTextActive]}>머신</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'gym' && s.tabBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab('gym'); }}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'gym' && s.tabBtnTextActive]}>헬스장</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'favorite' && s.tabBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab('favorite'); }}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'favorite' && s.tabBtnTextActive]}>즐겨찾기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'ranking' && s.tabBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab('ranking'); }}
            activeOpacity={0.75}
          >
            <Text style={[s.tabBtnText, activeTab === 'ranking' && s.tabBtnTextActive]}>랭킹</Text>
          </TouchableOpacity>
        </View>

        {/* Keyword search */}
        {activeTab !== 'ranking' && (
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
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setKeyword(''); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={16} color={C.textDim} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Machine tab filters */}
        {activeTab === 'machine' && (
          <>
            {/* Muscle filter */}
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filterRow}
                style={{ marginBottom: 6 }}
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
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveMuscle(on ? 'All' : opt); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.filterChipText, on && { color: C.bg }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Category filter - 부위 선택 시에만 표시 */}
            {activeMuscle !== 'All' && categories.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.filterRow}
                  style={{ flexGrow: 0 }}
                >
                  <TouchableOpacity
                    style={[
                      s.filterChip,
                      activeCategory === 'All' && { backgroundColor: C.textDim, borderColor: C.textDim },
                    ]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveCategory('All'); }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={12}
                      color={activeCategory === 'All' ? C.bg : C.textSub}
                    />
                    <Text style={[
                      s.filterChipText,
                      { marginLeft: 4 },
                      activeCategory === 'All' && { color: C.bg },
                    ]}>전체</Text>
                  </TouchableOpacity>

                  {categories.map(cat => {
                    const on = cat === activeCategory;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          s.filterChip,
                          on && { backgroundColor: C.accent, borderColor: C.accent },
                        ]}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveCategory(on ? 'All' : cat); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.filterChipText, on && { color: C.bg }]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Brand filter */}
            <View style={{ marginTop: 6 }}>
              <FilterRow
                sectionLabel="브랜드"
                options={brands}
                active={activeBrand}
                onSelect={setActiveBrand}
                activeColor={C.tagBrand.fg}
              />
            </View>

            {hasFilters && (
              <View style={s.filterSummaryRow}>
                <Ionicons name="options-outline" size={13} color={C.accent} />
                <Text style={s.filterSummaryText}>
                  {[
                    activeMuscle  !== 'All' && activeMuscle,
                    activeCategory !== 'All' && activeCategory,
                    activeBrand   !== 'All' && activeBrand,
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

      {/* Gym tab */}
      {activeTab === 'gym' && (
        <View style={{ flex: 1 }}>
          {/* 리스트/지도 토글 */}
          <View style={s.viewToggleRow}>
            <TouchableOpacity
              style={[s.viewToggleBtn, gymViewMode === 'list' && s.viewToggleBtnActive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGymViewMode('list'); }}
              activeOpacity={0.8}
            >
              <Ionicons name="list" size={14} color={gymViewMode === 'list' ? C.bg : C.textSub} />
              <Text style={[s.viewToggleText, gymViewMode === 'list' && s.viewToggleTextActive]}>리스트</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.viewToggleBtn, gymViewMode === 'map' && s.viewToggleBtnActive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGymViewMode('map'); }}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={14} color={gymViewMode === 'map' ? C.bg : C.textSub} />
              <Text style={[s.viewToggleText, gymViewMode === 'map' && s.viewToggleTextActive]}>지도</Text>
            </TouchableOpacity>
          </View>

          {/* 리스트 뷰 */}
          {gymViewMode === 'list' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[s.results, { paddingTop: 8 }]}
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
                    distLabel={getDistLabel(gym)}
                    onPress={() => {
                      setGymDetailId(gym.id);
                      setGymDetailVisible(true);
                    }}
                  />
                ))
              ))}
              <TouchableOpacity
                style={s.gymRequestBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowGymRequestModal(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color={C.accent} />
                <Text style={s.gymRequestBtnText}>내 헬스장 등록 요청하기</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          )}

          {/* 지도 뷰 */}
          {gymViewMode === 'map' && (
            <GymMapView
              gyms={filteredGymsForTab}
              userLocation={userLocation}
              selectedGymId={mapSelectedId}
              onSelectGym={gym => {
                if (mapSelectedId === gym.id) {
                  setGymDetailId(gym.id);
                  setGymDetailVisible(true);
                  setMapSelectedId(null);
                } else {
                  setMapSelectedId(gym.id);
                }
              }}
            />
          )}
        </View>
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
              {/* 즐겨찾기 머신 기반 추천 헬스장 */}
              <SectionHead title="내 머신 보유 추천 헬스장" count={0} />
              <FavoriteGymRecommendation
                userLocation={userLocation}
                onSelectGym={(gymId) => {
                  setGymDetailId(gymId);
                  setGymDetailVisible(true);
                }}
              />

              <View style={s.sectionDivider} />

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
                      distLabel={getDistLabel(gym)}
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

      {/* Ranking tab */}
      {activeTab === 'ranking' && (
        <RankingTab
          data={rankingData}
          loading={rankingLoading}
          olympicRankings={olympicRankings}
          olympicLoading={olympicLoading}
          onPressMachine={(machineId, machineName, machineBrand, targetMuscle) => {
            const found = allMachines.find(m => m.id === machineId);
            if (found) {
              setDetailMachine(found);
            }
          }}
          onPressGym={(gymId) => {
            setGymDetailId(gymId);
            setGymDetailVisible(true);
          }}
        />
      )}

      {/* Modals */}
      <MachineDetailModal
        visible={detailMachine !== null}
        machine={detailMachine}
        onClose={() => setDetailMachine(null)}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onSelectGym={(gymId) => {
          setDetailMachine(null);
          setTimeout(() => {
            setGymDetailId(gymId);
            setGymDetailVisible(true);
          }, 350);
        }}
      />

      <GymDetailModal
        visible={gymDetailVisible}
        gymId={gymDetailId}
        onClose={() => setGymDetailVisible(false)}
      />

      <Modal visible={showGymRequestModal} transparent animationType="slide" onRequestClose={() => setShowGymRequestModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>헬스장 등록 요청</Text>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: C.textSub, fontWeight: '600' }}>헬스장명 *</Text>
              <TextInput
                value={reqGymName}
                onChangeText={setReqGymName}
                placeholder="예) 짐픽 강남점"
                placeholderTextColor={C.textDim}
                style={{ backgroundColor: C.surface, borderRadius: R.inner, padding: 12, color: C.text, fontSize: 14 }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: C.textSub, fontWeight: '600' }}>위치 *</Text>
              <TextInput
                value={reqLocation}
                onChangeText={setReqLocation}
                placeholder="예) 서울 강남구 역삼동"
                placeholderTextColor={C.textDim}
                style={{ backgroundColor: C.surface, borderRadius: R.inner, padding: 12, color: C.text, fontSize: 14 }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: C.textSub, fontWeight: '600' }}>기타사항</Text>
              <TextInput
                value={reqNotes}
                onChangeText={setReqNotes}
                placeholder="추가로 알려주실 내용이 있으면 입력해주세요"
                placeholderTextColor={C.textDim}
                multiline
                numberOfLines={3}
                style={{ backgroundColor: C.surface, borderRadius: R.inner, padding: 12, color: C.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: R.btn, backgroundColor: C.surface, alignItems: 'center' }}
                onPress={() => setShowGymRequestModal(false)}
              >
                <Text style={{ color: C.textSub, fontWeight: '700' }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: R.btn, backgroundColor: C.accent, alignItems: 'center' }}
                onPress={handleSubmitGymRequest}
                disabled={reqLoading}
              >
                <Text style={{ color: C.bg, fontWeight: '800' }}>{reqLoading ? '신청 중...' : '신청하기'}</Text>
              </TouchableOpacity>
            </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  filterRow:      { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  filterChip:     {
    paddingHorizontal: 16,
    paddingVertical:   6,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    minHeight:         32,
    justifyContent:    'center',
    alignItems:        'center',
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: C.textSub },

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

  rankingEmptyBox: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginHorizontal: 4,
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    marginBottom:    8,
  },
  rankingEmptyTitle: {
    fontSize:   14,
    fontWeight: '700',
    color:      C.textSub,
    marginBottom: 6,
    textAlign:  'center',
  },
  rankingEmptyText: {
    fontSize:   12,
    color:      C.textDim,
    textAlign:  'center',
    lineHeight: 18,
  },

  viewToggleRow: {
    flexDirection:     'row',
    gap:               6,
    paddingHorizontal: 16,
    paddingVertical:   10,
    backgroundColor:   C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  viewToggleBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
  },
  viewToggleBtnActive: {
    backgroundColor: C.accent,
    borderColor:     C.accent,
  },
  viewToggleText: {
    fontSize:   13,
    fontWeight: '700',
    color:      C.textSub,
  },
  viewToggleTextActive: {
    color: C.bg,
  },

  gymRequestBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              8,
    marginHorizontal: 0,
    marginVertical:   16,
    paddingVertical:  14,
    borderRadius:     R.card,
    borderWidth:      1,
    borderColor:      C.accent,
    borderStyle:      'dashed',
  },
  gymRequestBtnText: {
    fontSize:   14,
    fontWeight: '700',
    color:      C.accent,
  },
});
