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
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import GymMapView from '../components/GymMapView';
import { C, R, T } from '../theme';
import { useAuth } from '../context/AuthContext';
import { perfStart, perfEnd } from '../lib/perf';
import { submitGymRegistrationRequest } from '../lib/db/gymRegistrationRequests';
import { fetchMachines, fetchGymsWithMachines, getGymsCacheSync, getMachinesCacheSync } from '../lib/db';
import { MachineWithGyms, GymWithMachines } from '../data/types';
import ManagerRequestModal from './flow/ManagerRequestModal';
import { isGymOpenNow } from '../lib/gymHours';
import { getGymFavorites } from '../data/gymFavoriteStore';
import { getFavoriteMachineIds } from '../data/favoritesStore';
import { getAllAdminGyms } from '../data/adminGymStore';
import GymDetailModal     from './flow/GymDetailModal';
import MachineDetailModal from './flow/MachineDetailModal';
import MachineCard        from '../components/MachineCard';
import MachineCardBorder  from '../components/MachineCardBorder';
import MachineFilterSheet from '../components/MachineFilterSheet';
import SegmentedToggle    from '../components/SegmentedToggle';
import { getMachineImageUrl } from '../lib/machineImageUrl';

import * as Location from 'expo-location';
import { calcDistanceKm, formatDistance } from '../lib/geocoding';
import FavoriteGymRecommendation from '../components/FavoriteGymRecommendation';
import { toEnMuscle, parseMuscles } from '../lib/splitUtils';
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
  const openStatus = isGymOpenNow(gym.hours);

  return (
    <TouchableOpacity style={s.gymCard} activeOpacity={0.8} onPress={onPress}>
      <View style={{ flex: 1, paddingLeft: 0 }}>
        <View style={s.gymCardTop}>
          <Text style={s.gymCardName}>{gym.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {gym.managerId && (
              <View style={s.managerBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#4A90E2" />
                <Text style={s.managerBadgeText}>헬스장 직접 관리</Text>
              </View>
            )}
            {openStatus !== null && (
              <View style={[
                s.openBadge,
                { backgroundColor: openStatus ? C.accentBg : C.dangerBg },
              ]}>
                <Text style={[
                  s.openBadgeText,
                  { color: openStatus ? C.accent : C.danger },
                ]}>
                  {openStatus ? '영업 중' : '영업 종료'}
                </Text>
              </View>
            )}
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
      <MachineCard
        machine={{ ...machine, imageUrl: getMachineImageUrl(machine.id, { width: cardWidth * 2 }) }}
        variant="grid"
        width={cardWidth}
      />
    </MachineCardBorder>
    {isFavorite && (
      <View style={s.favOverlay}>
        <Ionicons name="heart" size={18} color="#ff4d6d" />
      </View>
    )}
  </TouchableOpacity>
));

function shuffleMachines<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// --- Screen

export default function FindGymScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList<MachineWithGyms>>(null);
  const [keyword,          setKeyword]          = useState('');
  const [activeMuscle,     setActiveMuscle]     = useState('All');
  // 2026-09-09: 브랜드 필터를 단일선택 → 다중선택으로 변경(바텀시트 UI 개편).
  const [activeBrands,     setActiveBrands]     = useState<Set<string>>(new Set());
  const [activeCategory,   setActiveCategory]   = useState('All');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filterSheetTab,     setFilterSheetTab]     = useState<'muscle' | 'category' | 'brand'>('muscle');
  const [detailMachine,    setDetailMachine]    = useState<MachineWithGyms | null>(null);
  const [gymDetailId,      setGymDetailId]      = useState<string | null>(null);
  const [gymDetailVisible, setGymDetailVisible] = useState(false);
  // 2026-09-09: favoritesStore(전역 캐시, AuthContext가 로그인 시 Supabase에서
  // 채워둠)로부터 초기값을 가져오도록 변경 — 기존엔 항상 빈 Set으로 시작해서
  // 화면을 새로 열 때마다(그리고 당연히 앱 재시작 시) 즐겨찾기 표시가 사라졌었음.
  const [favorites,         setFavorites]         = useState<Set<string>>(() => new Set(getFavoriteMachineIds()));
  const [activeTab,         setActiveTab]         = useState<'machine' | 'gym' | 'favorite'>('machine');
  // 2026-09-09: 즐겨찾기가 검색바 옆 하트 아이콘 토글로 이동 — 재탭 시 이전에 보던
  // 머신/헬스장 탭으로 복귀시키기 위해 직전 탭을 기억해둔다.
  const [preFavoriteTab,  setPreFavoriteTab]  = useState<'machine' | 'gym'>('machine');
  const [gymFavoriteIds, setGymFavoriteIds] = useState<string[]>(() => getGymFavorites());

  function toggleFavoriteTab() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeTab === 'favorite') {
      setActiveTab(preFavoriteTab);
    } else {
      setPreFavoriteTab(activeTab);
      setActiveTab('favorite');
    }
  }

  // 2026-09-09: 머신⇄헬스장 토글 — 어느 쪽을 탭하든(이미 활성화된 쪽을 탭해도) 항상
  // 반대 값으로 전환되는 스위치 방식으로 변경. 즐겨찾기 화면에서는 두 값 다 비활성 상태로
  // 보이므로, 진입 직전 탭(preFavoriteTab)을 기준으로 반대쪽으로 전환한다.
  function flipMainTab() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const current = activeTab === 'favorite' ? preFavoriteTab : activeTab;
    setActiveTab(current === 'gym' ? 'machine' : 'gym');
  }

  // 2026-09-09: 리스트⇄지도 토글도 동일하게 스위치 방식으로 전환.
  function flipGymViewMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGymViewMode(prev => (prev === 'list' ? 'map' : 'list'));
  }

  useEffect(() => {
    setGymFavoriteIds(getGymFavorites());
    // 2026-09-09: 로그인 완료(AuthContext의 Supabase 즐겨찾기 로딩) 시점에 맞춰
    // 머신 즐겨찾기도 전역 캐시에서 다시 읽어와 동기화
    setFavorites(new Set(getFavoriteMachineIds()));
  }, [user?.id]);

  const [showGymRequestModal, setShowGymRequestModal] = useState(false);
  const [showManagerReqModal, setShowManagerReqModal] = useState(false);
  const [reqGymName,   setReqGymName]   = useState('');
  const [reqLocation,  setReqLocation]  = useState('');
  const [reqNotes,     setReqNotes]     = useState('');
  const [reqLoading,   setReqLoading]   = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gymViewMode,   setGymViewMode]   = useState<'list' | 'map'>('list');
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);

  const route = useRoute<any>();

  useEffect(() => {
    if (route.params?.initialTab === 'gym' && route.params?.viewMode === 'map') {
      setActiveTab('gym');
      setGymViewMode('map');
    }
  }, []);

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
    perfStart('FindGymScreen:fetchMachines');
    fetchMachines().then(data => {
      perfEnd('FindGymScreen:fetchMachines');
      if (!cancelled) { setMachinesData(data); setMachinesLoading(false); }
    }).catch(() => {
      perfEnd('FindGymScreen:fetchMachines');
      if (!cancelled) setMachinesLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    perfStart('FindGymScreen:fetchGymsWithMachines');
    fetchGymsWithMachines().then(data => {
      perfEnd('FindGymScreen:fetchGymsWithMachines');
      if (!cancelled) { setGymsData(data); setGymsLoading(false); }
    }).catch(() => {
      perfEnd('FindGymScreen:fetchGymsWithMachines');
      if (!cancelled) setGymsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const isLoading   = machinesLoading || gymsLoading;
  // 노브랜드(CUSTOM) 카탈로그 항목은 특정 제품이 아니라 부위별 범용 유형이라
  // "머신으로 찾기" 전역 탐색에는 노출하지 않는다 — 헬스장 상세(보유 머신
  // 전체보기)에서는 그대로 보여준다.
  const allMachines = (machinesData ?? []).filter(m => m.exerciseKind !== 'freeweight' && !m.isCustom);

  const [shuffleTick, setShuffleTick] = useState(0);
  const lastShuffleAtRef = useRef(0);
  // 2026-10-13: 기존에는 화면이 포커스될 때마다(탭을 잠깐 왔다갔다만 해도)
  // 머신 배열(~1,900개) 전체를 다시 섞었음 — 셔플 결과는 한동안 떠나있다가
  // 다시 들어왔을 때나 체감되는 변화라, 매 포커스마다 대형 배열을 재셔플하는
  // 건 낭비. 마지막 셔플 이후 일정 시간이 지났을 때만 다시 섞도록 스로틀.
  const SHUFFLE_INTERVAL_MS = 5 * 60 * 1000;

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastShuffleAtRef.current > SHUFFLE_INTERVAL_MS) {
        lastShuffleAtRef.current = now;
        setShuffleTick(t => t + 1);
      }
    }, [])
  );

  const shuffledMachines = useMemo(
    () => shuffleMachines(allMachines),
    [allMachines, shuffleTick]
  );

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
      allMachines.flatMap(m => parseMuscles(m.targetMuscle))
    )];
    const ordered = MUSCLE_ORDER.filter(m => unique.includes(m));
    const rest = unique.filter(m => !MUSCLE_ORDER.includes(m)).sort();
    return ['All', ...ordered, ...rest];
  }, [allMachines]);

  // 2026-09-09: MachineFilterSheet(바텀시트)에서 임의의(아직 적용 전인) 부위
  // 값에 대해서도 브랜드/카테고리 옵션을 미리 계산해야 해서, 기존
  // activeMuscle 전용 useMemo를 "부위를 인자로 받는 순수 함수"로 바꿈.
  // 화면에 실제로 쓰는 값(brands/categories)은 바로 아래에서 activeMuscle로
  // 호출한 결과를 그대로 useMemo로 캐싱해서 기존과 동일하게 동작함.
  const brandsForMuscle = useCallback((muscle: string) => {
    const sourceMachines = muscle === 'All'
      ? allMachines
      : allMachines.filter(m =>
          parseMuscles(m.targetMuscle).some(t => t.toLowerCase() === muscle.toLowerCase())
        );
    return [...new Set(sourceMachines.map(m => m.brand))].sort();
  }, [allMachines]);

  const categoriesForMuscle = useCallback((muscle: string) => {
    if (muscle === 'All') return [];

    const muscleFiltered = allMachines.filter(m =>
      parseMuscles(m.targetMuscle).some(t => t.toLowerCase() === muscle.toLowerCase())
    );

    const available = new Set(
      muscleFiltered.flatMap(m =>
        m.category
          ? m.category.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
          : []
      )
    );

    const muscleEn    = toEnMuscle(muscle) || muscle;
    const orderedList = CATEGORY_ORDER[muscleEn] ?? [];

    const ordered   = orderedList.filter(cat => available.has(cat));

    const remaining = [...available]
      .filter(cat => !orderedList.includes(cat))
      .sort();

    // 2026-09-09: 'Etc'가 들어간 카테고리(Chest_Etc, Leg_Etc, 그냥 'Etc' 등)는
    // 부위별 CATEGORY_ORDER 안에서 이미 각 목록 맨 끝에 있긴 하지만, 혹시
    // CATEGORY_ORDER에 없어서 remaining으로 빠지는 경우까지 포함해 항상
    // 최종 목록 제일 하단에 오도록 마지막에 한 번 더 정리.
    const combined = [...ordered, ...remaining];
    const nonEtc   = combined.filter(cat => !cat.toLowerCase().includes('etc'));
    const etcOnly  = combined.filter(cat => cat.toLowerCase().includes('etc'));

    return [...nonEtc, ...etcOnly];
  }, [allMachines]);

  const brands     = useMemo(() => ['All', ...brandsForMuscle(activeMuscle)], [brandsForMuscle, activeMuscle]);
  const categories = useMemo(() => categoriesForMuscle(activeMuscle), [categoriesForMuscle, activeMuscle]);

  useEffect(() => {
    if (activeBrands.size === 0) return;
    const validSet = new Set(brands.map(b => b.toLowerCase()));
    const filtered = new Set([...activeBrands].filter(b => validSet.has(b.toLowerCase())));
    if (filtered.size !== activeBrands.size) setActiveBrands(filtered);
  }, [brands, activeBrands]);

  // 2026-09-09: 예전엔 activeMuscle이 바뀌면 무조건 카테고리를 'All'로
  // 리셋했는데, 바텀시트에서 "부위+카테고리"를 한 번에 적용(onApply)하면
  // activeMuscle이 바뀌는 시점에 이 effect가 방금 적용한 카테고리 값을
  // 곧바로 덮어써버리는 문제가 있었음 — 유효할 때는 건드리지 않고, 새
  // 부위 기준으로 더 이상 유효하지 않을 때만 리셋하도록 검증 방식으로 변경.
  useEffect(() => {
    if (activeCategory === 'All') return;
    if (!categories.includes(activeCategory)) setActiveCategory('All');
  }, [categories, activeCategory]);

  // 결과 개수 계산 — MachineFilterSheet의 "OOO개 머신보기" 버튼에서
  // 임시(적용 전) 선택값 기준으로 실시간 계산할 때 재사용.
  const computeMachineCount = useCallback((muscle: string, category: string, brandSet: Set<string>) => {
    return shuffledMachines.filter(m => {
      const muscleOk   = muscle === 'All' || parseMuscles(m.targetMuscle).some(t => t.toLowerCase() === muscle.toLowerCase());
      const brandOk    = brandSet.size === 0 || [...brandSet].some(b => b.toLowerCase() === m.brand?.toLowerCase());
      const categoryOk = category === 'All' || m.category?.split(',').map(c => c.trim()).includes(category);
      return muscleOk && brandOk && categoryOk;
    }).length;
  }, [shuffledMachines]);

  // 2026-09-09: MachineDetailModal이 이 콜백을 부를 시점엔 이미 favoritesStore(전역
  // 캐시)가 갱신되어 있으므로, 직접 뒤집는 대신 전역 캐시에서 다시 읽어와 동기화한다
  // (두 상태가 서로 다르게 어긋나는 것을 방지).
  function toggleFavorite(id: string) {
    setFavorites(new Set(getFavoriteMachineIds()));
  }

  const hasFilters =
    keyword.trim().length > 0 || activeMuscle !== 'All' || activeBrands.size > 0 || activeCategory !== 'All';

  function clearAll() {
    setKeyword('');
    setActiveMuscle('All');
    setActiveBrands(new Set());
    setActiveCategory('All');
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  function openFilterSheet(tab: 'muscle' | 'category' | 'brand') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFilterSheetTab(tab);
    setFilterSheetVisible(true);
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

  function handleOpenManagerRequestFromGymPopup() {
    if (!user) {
      setShowGymRequestModal(false);
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    setShowGymRequestModal(false);
    setShowManagerReqModal(true);
  }

  // --- Filtered machines
  const filteredMachines = useMemo(() => {
    return shuffledMachines.filter(m => {
      const muscleOk   = activeMuscle === 'All' || parseMuscles(m.targetMuscle).some(t => t.toLowerCase() === activeMuscle.toLowerCase());
      const brandOk    = activeBrands.size === 0 || [...activeBrands].some(b => b.toLowerCase() === m.brand?.toLowerCase());
      const categoryOk = activeCategory === 'All' ||
        m.category?.split(',').map(c => c.trim()).includes(activeCategory);
      const kw         = keyword.trim().toLowerCase();
      const keyOk      = !kw ||
        m.name.toLowerCase().includes(kw)     ||
        m.category.toLowerCase().includes(kw) ||
        m.brand?.toLowerCase().includes(kw);
      return muscleOk && brandOk && categoryOk && keyOk;
    });
  }, [keyword, activeMuscle, activeBrands, activeCategory, shuffledMachines]);

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
        {/* Title row — 2026-09-09: 머신/헬스장/즐겨찾기/랭킹 4탭 라인을 없애고,
            머신⇄헬스장은 제목 우측 토글로, 즐겨찾기는 검색바 옆 하트 아이콘으로 이동 */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>머신 · 헬스장 찾기</Text>
            <Text style={s.headerSub}>머신, 부위, 브랜드로 검색하세요</Text>
          </View>
          {/* 2026-09-09: SegmentedToggle로 교체 — 탭 전환 시 배경 하이라이트가
              부드럽게 슬라이드되는 애니메이션 적용.
              2026-09-09(2차): 어느 쪽을 탭해도 반대 값으로 전환되는 스위치 방식으로 변경
              — 두 옵션이 같은 flipMainTab 핸들러를 공유 */}
          <SegmentedToggle
            style={s.mainToggle}
            options={[
              {
                key: 'machine',
                active: activeTab === 'machine',
                onPress: flipMainTab,
                render: () => (
                  <View style={s.mainToggleBtn}>
                    <Text style={[s.mainToggleText, activeTab === 'machine' && s.mainToggleTextActive]}>머신</Text>
                  </View>
                ),
              },
              {
                key: 'gym',
                active: activeTab === 'gym',
                onPress: flipMainTab,
                render: () => (
                  <View style={s.mainToggleBtn}>
                    <Text style={[s.mainToggleText, activeTab === 'gym' && s.mainToggleTextActive]}>헬스장</Text>
                  </View>
                ),
              },
            ]}
          />
        </View>

        {/* Keyword search — 즐겨찾기 하트 토글(항상), 리스트/지도 토글(헬스장 탭에서만) 포함 */}
        <View style={s.searchRow}>
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
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setKeyword(''); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={16} color={C.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {/* 2026-09-09: 리스트/지도 버튼 2개 → 토글 1개로 통합, 헬스장 검색바 우측으로 이동.
              SegmentedToggle로 부드러운 슬라이드 애니메이션 적용.
              2026-09-09(2차): 어느 쪽을 탭해도 반대 값으로 전환되는 스위치 방식 —
              두 옵션이 같은 flipGymViewMode 핸들러를 공유 */}
          {activeTab === 'gym' && (
            <SegmentedToggle
              style={s.viewToggleInline}
              options={[
                {
                  key: 'list',
                  active: gymViewMode === 'list',
                  onPress: flipGymViewMode,
                  render: () => (
                    <View style={s.viewToggleInlineBtn}>
                      <Ionicons name="list" size={15} color={gymViewMode === 'list' ? C.bg : C.textSub} />
                    </View>
                  ),
                },
                {
                  key: 'map',
                  active: gymViewMode === 'map',
                  onPress: flipGymViewMode,
                  render: () => (
                    <View style={s.viewToggleInlineBtn}>
                      <Ionicons name="map-outline" size={15} color={gymViewMode === 'map' ? C.bg : C.textSub} />
                    </View>
                  ),
                },
              ]}
            />
          )}

          <TouchableOpacity
            style={[s.favToggleBtn, activeTab === 'favorite' && s.favToggleBtnActive]}
            onPress={toggleFavoriteTab}
            activeOpacity={0.75}
          >
            <Ionicons
              name={activeTab === 'favorite' ? 'heart' : 'heart-outline'}
              size={18}
              color={activeTab === 'favorite' ? '#ff4d6d' : C.textSub}
            />
          </TouchableOpacity>
        </View>

        {/* Machine tab filters — 2026-09-09: 가로 칩 스크롤 3줄을 필터 버튼 1줄 +
            바텀시트(MachineFilterSheet)로 교체. 옵션이 많은 브랜드는 검색+
            알파벳 리스트+다중선택이 가능해지고, 부위/카테고리도 같은 시트 안
            탭으로 묶여서 화면이 훨씬 간결해짐. 초기화 버튼도 같은 줄로 이동. */}
        {activeTab === 'machine' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterPillRow}
          >
            <TouchableOpacity
              style={[s.filterPillBtn, activeMuscle !== 'All' && s.filterPillBtnActive]}
              onPress={() => openFilterSheet('muscle')}
              activeOpacity={0.75}
            >
              <Text style={[s.filterPillText, activeMuscle !== 'All' && s.filterPillTextActive]}>
                {activeMuscle === 'All' ? '부위' : activeMuscle}
              </Text>
              <Ionicons name="chevron-down" size={14} color={activeMuscle !== 'All' ? C.bg : C.textSub} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.filterPillBtn, activeCategory !== 'All' && s.filterPillBtnActive]}
              onPress={() => openFilterSheet('category')}
              activeOpacity={0.75}
            >
              <Text style={[s.filterPillText, activeCategory !== 'All' && s.filterPillTextActive]} numberOfLines={1}>
                {activeCategory === 'All' ? '카테고리' : activeCategory}
              </Text>
              <Ionicons name="chevron-down" size={14} color={activeCategory !== 'All' ? C.bg : C.textSub} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.filterPillBtn, activeBrands.size > 0 && s.filterPillBtnActive]}
              onPress={() => openFilterSheet('brand')}
              activeOpacity={0.75}
            >
              <Text style={[s.filterPillText, activeBrands.size > 0 && s.filterPillTextActive]}>
                {activeBrands.size === 0 ? '브랜드' : `브랜드 ${activeBrands.size}`}
              </Text>
              <Ionicons name="chevron-down" size={14} color={activeBrands.size > 0 ? C.bg : C.textSub} />
            </TouchableOpacity>

            {hasFilters && (
              <TouchableOpacity style={s.clearBtnInline} onPress={clearAll} activeOpacity={0.75}>
                <Ionicons name="refresh" size={13} color={C.accent} />
                <Text style={s.clearBtnInlineText}>초기화</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
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
          {/* 리스트/지도 토글 — 2026-09-09: 검색바 옆 토글로 이동 (위 searchRow 참고) */}

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
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowGymRequestModal(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color={C.accent} />
                <Text style={s.gymRequestBtnText}>내가 다니는 헬스장 등록요청하기</Text>
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

      {/* Modals */}
      <MachineDetailModal
        visible={detailMachine !== null}
        machine={detailMachine}
        onClose={() => setDetailMachine(null)}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        isSearchEntry
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

      <MachineFilterSheet
        visible={filterSheetVisible}
        initialTab={filterSheetTab}
        onClose={() => setFilterSheetVisible(false)}
        onApply={({ muscle, category, brands: newBrands }) => {
          setActiveMuscle(muscle);
          setActiveCategory(category);
          setActiveBrands(newBrands);
        }}
        muscleOptions={muscleOptions}
        initialMuscle={activeMuscle}
        getCategoryOptions={categoriesForMuscle}
        initialCategory={activeCategory}
        getBrandOptions={brandsForMuscle}
        initialBrands={activeBrands}
        computeCount={computeMachineCount}
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

            <TouchableOpacity style={s.gymReqManagerLink} activeOpacity={0.7} onPress={handleOpenManagerRequestFromGymPopup}>
              <Text style={s.gymReqManagerLinkText}>
                혹시 헬스장을 운영하고 계실까요?{' '}
                <Text style={s.gymReqManagerLinkAccent}>매니저로 신청하기</Text>
              </Text>
            </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ManagerRequestModal
        visible={showManagerReqModal}
        userId={user?.id ?? ''}
        onClose={() => setShowManagerReqModal(false)}
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
  // 2026-09-09부터 미사용 (초기화 버튼이 헤더에서 필터 라인으로 이동 — clearBtnInline 참고)
  clearBtn:    {
    marginTop: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: C.accent },

  // 2026-09-09: 머신⇄헬스장 전환 토글 (헤더 우측, 기존 tabRow 대체)
  // 2026-09-09: 컨테이너 배경/테두리/슬라이딩 하이라이트는 SegmentedToggle 컴포넌트가
  // 자체적으로 그려주므로, 여기서는 헤더 안에서의 위치(marginTop)만 지정
  mainToggle: { marginTop: 2 },
  mainToggleBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: R.pill,
  },
  mainToggleText:       { fontSize: 13, fontWeight: '700', color: C.textSub },
  mainToggleTextActive: { color: C.bg },

  // Search — 2026-09-09: 즐겨찾기(하트)/리스트·지도 토글을 같은 줄에 배치하기 위해
  // 검색창(searchWrap)을 감싸는 가로 행(searchRow) 추가
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: C.surface,
    borderRadius:   R.inner,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  // 즐겨찾기 하트 토글 버튼 (검색바 우측)
  favToggleBtn: {
    width: 40, height: 40,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  favToggleBtnActive: {
    backgroundColor: '#ff4d6d18',
    borderColor: '#ff4d6d40',
  },

  // 초기화 버튼 — 2026-09-09: 헤더에서 머신 탭 필터 라인으로 이동
  clearBtnInline: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  clearBtnInlineText: { fontSize: 13, fontWeight: '700', color: C.accent },

  // 리스트/지도 토글 (헬스장 탭 검색바 우측) — 2026-09-09: 별도 버튼 2개 → 토글 1개로 통합
  // 컨테이너 스타일은 SegmentedToggle 자체 기본값 사용 (추가 위치 조정 불필요)
  viewToggleInline: {},
  viewToggleInlineBtn: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: R.pill,
  },

  // Machine tab filter pills — 2026-09-09: 바텀시트(MachineFilterSheet)를 여는 버튼 3개
  filterPillRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  filterPillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    maxWidth: 130,
  },
  filterPillBtnActive: { backgroundColor: C.text, borderColor: C.text },
  filterPillText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  filterPillTextActive: { color: C.bg },

  // Filters (2026-09-09부터 미사용 — 부위/카테고리/브랜드 가로 칩 방식을
  // MachineFilterSheet 바텀시트로 교체하며 대체됨. 참고용으로만 남겨둠)
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
  filterChipSmall: {
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    minHeight:         26,
    justifyContent:    'center',
    alignItems:        'center',
  },
  filterChipTextSmall: { fontSize: 12, fontWeight: '600', color: C.textSub },

  // unused
  filterSummaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: C.accentBg,
    marginBottom: 4,
  },
  // unused
  filterSummaryText:  { flex: 1, fontSize: 12, fontWeight: '600', color: C.accent },
  // unused
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

  // 2026-09-09부터 미사용 (4탭 라인 삭제 — 머신/헬스장은 mainToggle, 즐겨찾기는 favToggleBtn으로 대체)
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
  managerBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#4A90E218', borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 3 },
  managerBadgeText: { fontSize: 11, fontWeight: '700', color: '#4A90E2' },
  distBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accentBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  distText:      { fontSize: 11, fontWeight: '700', color: C.accent },
  gymMatchText:  { fontSize: 12, color: C.textSub },

  // 2026-09-09부터 미사용 (랭킹 탭 삭제 — 이번 주 인기 머신/인기 헬스장은 홈 화면으로 이전)
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

  // 2026-09-09부터 미사용 (검색바 아래 별도 행 → 검색바 우측 viewToggleInline으로 대체)
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

  gymReqManagerLink:       { alignItems: 'center', marginTop: 4 },
  gymReqManagerLinkText:   { fontSize: 13, color: C.textSub, textAlign: 'center' },
  gymReqManagerLinkAccent: { color: C.accent, fontWeight: '700' },
});
