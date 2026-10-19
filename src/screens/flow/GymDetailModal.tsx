import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { fetchGymPhotoUrls } from '../../lib/db/gymPhotos';
import { parseMuscles } from '../../lib/splitUtils';
import GymAllMachinesScreen from './GymAllMachinesScreen';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { brandLogos } from '../../constants/brandLogos';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GymReportType } from '../../lib/db/gymReports';
import { submitGymInfoReport } from '../../lib/db/gymInfoReports';
import { useAuth } from '../../context/AuthContext';
import { track } from '../../lib/analytics';
import { useNavigation } from '@react-navigation/native';
import { C, R, T } from '../../theme';
import { fetchGymWithMachines } from '../../lib/db/gyms';
import { GymWithMachines } from '../../data/types';
import { GYM_DETAILS } from '../../data/gymDetails';
import MachineDetailModal from './MachineDetailModal';
import { isGymFavorite, toggleGymFavorite } from '../../data/gymFavoriteStore';
import { addGymFavoriteDB, removeGymFavoriteDB } from '../../lib/db/gymFavorites';
import GymCommunityTab from './community/GymCommunityTab';
import MachineCard from '../../components/MachineCard';
import MachineCardBorder from '../../components/MachineCardBorder';
import { getMachineImageUrl } from '../../lib/machineImageUrl';
import { containsBannedWord } from '../../lib/bannedWords';
import { shareGym } from '../../lib/share';
import GymOunwanStrip from '../../components/gym/GymOunwanStrip';
import GymHoursRow from '../../components/gym/GymHoursRow';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W   = (SCREEN_W - 32 - 8) / 2;

// --- Sub-components

const GymPhotoStrip = React.memo(({
  gymId,
  onPressPhoto,
}: {
  gymId:        string;
  onPressPhoto: (urls: string[], index: number) => void;
}) => {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!gymId) return;
    setLoading(true);
    fetchGymPhotoUrls(gymId)
      .then(urls => setPhotoUrls(urls))
      .finally(() => setLoading(false));
  }, [gymId]);

  if (!loading && photoUrls.length === 0) return null;

  if (loading) {
    return (
      <View style={s.photoStrip}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[s.photoCard, { backgroundColor: C.surface }]} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}
    >
      {photoUrls.map((url, idx) => (
        <TouchableOpacity
          key={idx}
          onPress={() => onPressPhoto(photoUrls, idx)}
          activeOpacity={0.85}
        >
          <ExpoImage
            source={{ uri: url }}
            style={{ width: 160, height: 120, borderRadius: R.card }}
            contentFit="cover"
          />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

const PhotoViewer = React.memo(({
  urls,
  initialIndex,
  onClose,
}: {
  urls:         string[];
  initialIndex: number;
  onClose:      () => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const SCREEN_W = Dimensions.get('window').width;
  const SCREEN_H = Dimensions.get('window').height;

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>

        {/* 닫기 버튼 */}
        <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
          }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              {currentIndex + 1} / {urls.length}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* 사진 가로 스크롤 (페이지 방식) */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * SCREEN_W, y: 0 }}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrentIndex(idx);
          }}
          style={{ flex: 1 }}
        >
          {urls.map((url, idx) => (
            <View
              key={idx}
              style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center' }}
            >
              <ExpoImage
                source={{ uri: url }}
                style={{ width: SCREEN_W, height: SCREEN_H }}
                contentFit="contain"
              />
            </View>
          ))}
        </ScrollView>

      </View>
    </Modal>
  );
});

const GymMachineItem = React.memo(({
  machine,
  cardWidth,
  onPress,
}: {
  machine: GymWithMachines['machines'][number];
  cardWidth: number;
  onPress: (machineId: string) => void;
}) => (
  <TouchableOpacity
    onPress={() => onPress(machine.id)}
    activeOpacity={0.85}
  >
    <MachineCardBorder width={cardWidth}>
      <MachineCard
        machine={{ ...machine, imageUrl: getMachineImageUrl(machine.id, { width: cardWidth * 2 }) }}
        variant="grid"
        width={cardWidth}
      />
    </MachineCardBorder>
  </TouchableOpacity>
));

// --- Props

interface Props {
  visible: boolean;
  gymId:   string | null;
  onClose: () => void;
  // 2026-10-19 (F6-2a): 링크(#machine=)로 열렸을 때 — 이 헬스장이 보유한 머신이면 머신 상세를 바로 띄운다
  initialMachineId?: string;
}

// --- Tab type

type GymTab = '머신' | '정보' | '커뮤니티';
// 탭 순서 = 좌우 스와이프 페이지 순서 (2026-10-20)
const TAB_ORDER: GymTab[] = ['머신', '정보', '커뮤니티'];

// --- Component

export default function GymDetailModal({ visible, gymId, onClose, initialMachineId }: Props) {
  const [gym, setGym] = React.useState<GymWithMachines | undefined>(undefined);
  React.useEffect(() => {
    if (!gymId) return;
    fetchGymWithMachines(gymId).then(result => setGym(result ?? undefined));
  }, [gymId]);
  const details = gymId ? GYM_DETAILS[gymId] : undefined;

  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [selectedMachineId,   setSelectedMachineId]   = useState<string | null>(null);
  const [isFav,               setIsFav]               = useState(false);
  const [activeTab,           setActiveTab]           = useState<GymTab>('정보');
  // ── 좌우 스와이프 탭 (2026-10-20) ──
  // 가로 페이지 ScrollView 하나에 탭 3개를 나란히 두고, 탭 버튼과 스와이프가 같은 상태를 쓴다.
  // 처음 들어간 탭만 렌더한다(머신 그리드가 무거워서 미리 그리지 않음).
  const pagerRef = useRef<ScrollView>(null);
  const [pageSize,    setPageSize]    = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [visitedTabs, setVisitedTabs] = useState<Set<GymTab>>(() => new Set<GymTab>(['정보']));
  const activeTabRef = useRef<GymTab>('정보');
  activeTabRef.current = activeTab;

  function markVisited(tab: GymTab) {
    setVisitedTabs(prev => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }

  function goToTab(tab: GymTab, animated = true) {
    setActiveTab(tab);
    markVisited(tab);
    const w = pageSize.w;
    if (w > 0) pagerRef.current?.scrollTo({ x: TAB_ORDER.indexOf(tab) * w, animated });
  }

  // 페이저가 (다시) 그려질 때마다 현재 탭 위치로 맞춘다. 페이지 너비가 state로 반영된 뒤에
  // 스크롤해야 Android에서 0으로 잘리지 않으므로 effect에서 처리하고, 맞추기 전에는 숨겨 둔다.
  const [pagerReady,  setPagerReady]  = useState(false);
  const [layoutTick,  setLayoutTick]  = useState(0);

  function handlePagerLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== pageSize.w || height !== pageSize.h) setPageSize({ w: width, h: height });
    setLayoutTick(t => t + 1);
  }

  useEffect(() => {
    if (pageSize.w <= 0) return;
    const id = requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: TAB_ORDER.indexOf(activeTabRef.current) * pageSize.w, animated: false });
      setPagerReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [layoutTick, pageSize.w]);

  // 모달이 닫히면 페이저가 언마운트되므로, 다시 열릴 때 위치를 맞추기 전까지 숨긴다
  useEffect(() => { if (!visible) setPagerReady(false); }, [visible]);

  function handlePagerMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const w = pageSize.w;
    if (w <= 0) return;
    const idx = Math.max(0, Math.min(TAB_ORDER.length - 1, Math.round(e.nativeEvent.contentOffset.x / w)));
    const tab = TAB_ORDER[idx];
    if (tab !== activeTabRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(tab);
      markVisited(tab);
    }
  }
  const [showAllMachines,     setShowAllMachines]     = useState(false);
  const [machineMuscleFilter, setMachineMuscleFilter] = useState('전체');
  const [machineBrandFilter,  setMachineBrandFilter]  = useState('전체');
  const [showReport,          setShowReport]          = useState(false);
  const [reportType,          setReportType]          = useState<GymReportType>('other');
  const [reportMsg,           setReportMsg]           = useState('');
  const [reportSent,          setReportSent]          = useState(false);
  const [reportLoading,       setReportLoading]       = useState(false);
  const [viewerUrls,          setViewerUrls]          = useState<string[]>([]);
  const [viewerIndex,         setViewerIndex]         = useState(0);
  const [viewerVisible,       setViewerVisible]       = useState(false);

  function openPhotoViewer(urls: string[], index: number) {
    setViewerUrls(urls);
    setViewerIndex(index);
    setViewerVisible(true);
  }

  useEffect(() => {
    setIsFav(gymId ? isGymFavorite(gymId) : false);
    setActiveTab('정보');
    setVisitedTabs(new Set<GymTab>(['정보']));
    if (pageSize.w > 0) pagerRef.current?.scrollTo({ x: TAB_ORDER.indexOf('정보') * pageSize.w, animated: false });
    setMachineMuscleFilter('전체');
    setMachineBrandFilter('전체');
  }, [gymId]);

  // 매니저 통계 '헬스장 페이지 조회수' 집계용 (F5). 본인 헬스장 매니저 조회는 제외.
  // 모달이 열린 동안 헬스장당 1회만 보낸다(탭 전환·리렌더로 중복 X). 닫히면
  // 초기화해서, 다시 열면 새 조회로 집계된다.
  const trackedViewGymIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) {
      trackedViewGymIdRef.current = null;
      return;
    }
    if (!gymId || !gym || gym.id !== gymId) return;       // 해당 헬스장 데이터 로딩 후에만
    if (trackedViewGymIdRef.current === gymId) return;   // 이번 열림에서 이미 집계함
    trackedViewGymIdRef.current = gymId;
    if (gym.managerId && gym.managerId === user?.id) return;
    track('view_gym', { gym_id: gymId });
  }, [visible, gymId, gym, user?.id]);

  // 링크로 받은 머신을 열림당 한 번만 띄운다(사용자가 머신 상세를 닫아도 다시 열리지 않게).
  // 보유하지 않은 머신이면 헬스장만 보여준다. 모달이 닫히면 초기화.
  const openedInitialMachineRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) {
      openedInitialMachineRef.current = null;
      return;
    }
    if (!initialMachineId || !gymId || !gym || gym.id !== gymId) return;
    const key = `${gymId}|${initialMachineId}`;
    if (openedInitialMachineRef.current === key) return;
    openedInitialMachineRef.current = key;
    if (gym.machines.some(m => m.id === initialMachineId)) {
      setSelectedMachineId(initialMachineId);
    }
  }, [visible, gymId, gym, initialMachineId]);

  const gymMachines = gym?.machines ?? [];

  const muscleOptions = useMemo(() => {
    const unique = [...new Set(gymMachines.flatMap(m => parseMuscles(m.targetMuscle)))].sort();
    return ['전체', ...unique];
  }, [gymMachines]);

  const brandOptions = useMemo(() => {
    const unique = [...new Set(gymMachines.map(m => m.brand).filter(Boolean))].sort();
    return ['전체', ...unique];
  }, [gymMachines]);

  const filteredMachines = useMemo(() => {
    return gymMachines.filter(m => {
      const muscleOk = machineMuscleFilter === '전체' ||
        parseMuscles(m.targetMuscle).some(t => t.toLowerCase() === machineMuscleFilter.toLowerCase());
      const brandOk  = machineBrandFilter === '전체' ||
        m.brand?.toLowerCase() === machineBrandFilter.toLowerCase();
      return muscleOk && brandOk;
    });
  }, [gymMachines, machineMuscleFilter, machineBrandFilter]);

  if (!gymId) return null;

  // 2026-09-09: 헬스장 데이터(gym)가 아직 로딩 중이어도 Modal 자체는 즉시 mount해서
  // 슬라이드 애니메이션을 바로 시작한다. 예전엔 데이터가 도착할 때까지 여기서 null을
  // 반환해버려서, 목록에서 헬스장을 탭한 순간부터 네트워크 조회가 끝날 때까지 화면이
  // 아무 반응 없이 멈춰있는 것처럼 보이는 지연 문제가 있었음.
  if (!gym) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView style={s.safe}>
          <View style={s.navHeader}>
            <TouchableOpacity style={s.navBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={C.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <View style={s.navBtn} />
          </View>
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  const machineForDetail = selectedMachineId
    ? gym.machines.find(m => m.id === selectedMachineId) ?? null
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe}>

        {/* Nav header */}
        <View style={s.navHeader}>
          <TouchableOpacity style={s.navBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={s.navTitle} numberOfLines={1}>{gym.name}</Text>
          <View style={{ flexDirection: 'row' }}>
            {/* 보유 머신 웹페이지는 매니저가 연결된 헬스장에서만 실제로 열람 가능하므로,
                공유 버튼도 매니저 연결 헬스장에서만 노출한다. */}
            {gym.managerId && (
              <TouchableOpacity
                style={s.navBtn}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  shareGym(gym.name, gym.id);
                }}
              >
                <Ionicons name="share-outline" size={20} color={C.textSub} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.navBtn}
              activeOpacity={0.7}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (!user) { onClose(); nav.navigate('Profile'); return; }
                const next = toggleGymFavorite(gym.id);
                setIsFav(next);
                if (next) {
                  await addGymFavoriteDB(user.id, gym.id);
                } else {
                  await removeGymFavoriteDB(user.id, gym.id);
                }
              }}
            >
              <Ionicons
                name={isFav ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isFav ? C.accent : C.textSub}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={s.tabBar}>
          {TAB_ORDER.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToTab(tab); }}
              activeOpacity={0.8}
            >
              <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 탭 본문: 좌우 스와이프 페이지 (머신 | 정보 | 커뮤니티) ── */}
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, opacity: pagerReady ? 1 : 0 }}
          onLayout={handlePagerLayout}
          onMomentumScrollEnd={handlePagerMomentumEnd}
        >
        {/* ── 머신 tab ── */}
        <View style={{ width: pageSize.w, height: pageSize.h }}>
        {visitedTabs.has('머신') && (
          <FlatList
            nestedScrollEnabled
            data={filteredMachines}
            keyExtractor={(m) => m.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 8 }}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            removeClippedSubviews={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
            renderItem={({ item: machine }) => (
              <GymMachineItem
                machine={machine}
                cardWidth={CARD_W}
                onPress={setSelectedMachineId}
              />
            )}
            ListHeaderComponent={
              <View>
                {/* 타겟부위 필터 */}
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.filterRow}
                >
                  {muscleOptions.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.filterChip, machineMuscleFilter === opt && s.filterChipActive]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMachineMuscleFilter(opt); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.filterChipText, machineMuscleFilter === opt && s.filterChipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* 브랜드 필터 */}
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.filterRow}
                >
                  {brandOptions.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.filterChip, machineBrandFilter === opt && s.filterChipActive]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMachineBrandFilter(opt); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.filterChipText, machineBrandFilter === opt && s.filterChipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={
              <View style={s.emptyState}>
                <Ionicons name="barbell-outline" size={36} color={C.textDim} />
                <Text style={s.emptyText}>조건에 맞는 머신이 없어요</Text>
              </View>
            }
          />
        )}
        </View>

        {/* ── 정보 tab ── */}
        <View style={{ width: pageSize.w, height: pageSize.h }}>
        {visitedTabs.has('정보') && (
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

            {/* ── 헬스장 사진 ── */}
            <GymPhotoStrip gymId={gymId} onPressPhoto={openPhotoViewer} />

            {/* ── Gym name + location ── */}
            <View style={s.gymHeader}>
              <Text style={s.gymName}>{gym.name}</Text>
              <View style={s.gymLocRow}>
                <Ionicons name="location-outline" size={13} color={C.textSub} />
                <Text style={s.gymLoc}>{gym.location}</Text>
              </View>
              {gym.managerId && (
                <View style={s.managerBadge}>
                  <Ionicons name="shield-checkmark" size={11} color="#4A90E2" />
                  <Text style={s.managerBadgeText}>헬스장 직접 관리</Text>
                </View>
              )}
            </View>

            {/* ── 헬스장 소개 ── */}
            {gym.description ? (
              <>
                <Text style={s.sectionTitle}>헬스장 소개</Text>
                <View style={s.card}>
                  <Text style={[s.infoText, { padding: 16, lineHeight: 22 }]}>
                    {gym.description}
                  </Text>
                </View>
              </>
            ) : null}

            {/* ── Info card ── */}
            <View style={s.infoCard}>
              <View style={s.infoRow}>
                <View style={s.infoIcon}>
                  <Ionicons name="call-outline" size={14} color={C.accent} />
                </View>
                <Text style={s.infoText}>{gym.phone || details?.phone || '정보 없음'}</Text>
              </View>
              <View style={[s.infoRow, { marginTop: 12 }]}>
                <View style={s.infoIcon}>
                  <Ionicons name="location-outline" size={14} color={C.accent} />
                </View>
                <Text style={s.infoText}>{gym.location}</Text>
              </View>
              {/* 영업시간: 오늘만 보여주고 탭하면 월~일 + 메모 펼침 (2026-10-20) */}
              <GymHoursRow hours={gym.hours} legacyHours={details?.hours} note={gym.hoursNote} />
            </View>

            {/* ── 오운완 (최근 5개) ── */}
            <GymOunwanStrip
              gymId={gymId}
              titleStyle={s.sectionTitle}
              onPressMore={() => goToTab('커뮤니티')}
              onPressMachine={setSelectedMachineId}
            />

            {/* ── Notices ── */}
            {details?.notices && details.notices.length > 0 && (
              <React.Fragment>
                <Text style={s.sectionTitle}>공지사항</Text>
                <View style={s.card}>
                  {details.notices.map((n, i) => (
                    <View key={i} style={[s.noticeRow, i > 0 && s.noticeBorder]}>
                      <View style={s.noticeTitleRow}>
                        <Ionicons name="megaphone-outline" size={13} color={C.accent} />
                        <Text style={s.noticeTitle}>{n.title}</Text>
                        <Text style={s.noticeDate}>{n.date}</Text>
                      </View>
                      <Text style={s.noticeBody}>{n.body}</Text>
                    </View>
                  ))}
                </View>
              </React.Fragment>
            )}

            {/* ── Pricing ── */}
            {details?.pricing && details.pricing.length > 0 ? (
              <React.Fragment>
                <Text style={s.sectionTitle}>이용 요금</Text>
                <View style={s.card}>
                  {details.pricing.map((tier, i) => (
                    <View key={i} style={[s.priceRow, i > 0 && s.priceBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.priceLabel}>{tier.label}</Text>
                        {tier.note && <Text style={s.priceNote}>{tier.note}</Text>}
                      </View>
                      <Text style={s.priceValue}>{tier.price}</Text>
                    </View>
                  ))}
                </View>
              </React.Fragment>
            ) : null}



            {/* 오피셜 센터 섹션 */}
            {gym.officialBrands && gym.officialBrands.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="shield-checkmark" size={14} color="#5ba4ff" />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#5ba4ff' }}>오피셜 센터</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {gym.officialBrands.map(brand => {
                    const key = brand.toUpperCase().replace(/\s+/g, '_');
                    const logo = brandLogos[key];
                    return (
                      <View
                        key={brand}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: '#1e2230',
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: '#5ba4ff40',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        {logo ? (
                          <View style={{ backgroundColor: '#ffffff', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 }}>
                            <Image source={logo} style={{ width: 48, height: 18 }} resizeMode="contain" />
                          </View>
                        ) : (
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#5ba4ff' }}>{brand}</Text>
                        )}
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#5ba4ff' }}>OFFICIAL</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── 정보 제보하기 ── */}
            <TouchableOpacity
              style={s.reportBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReportSent(false); setReportMsg(''); setReportType('other'); setShowReport(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="flag-outline" size={14} color={C.textDim} />
              <Text style={s.reportBtnText}>정보 제보하기</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
        </View>

        {/* ── 커뮤니티 tab ── */}
        <View style={{ width: pageSize.w, height: pageSize.h }}>
        {visitedTabs.has('커뮤니티') && (
          <GymCommunityTab gymId={gymId} gymName={gym.name} onPressMachine={setSelectedMachineId} />
        )}
        </View>
        </ScrollView>
      </SafeAreaView>

      <MachineDetailModal
        visible={selectedMachineId !== null}
        machine={machineForDetail}
        onClose={() => setSelectedMachineId(null)}
        gymId={gym.id}
      />

      {/* ── 사진 전체화면 뷰어 ── */}
      {viewerVisible && (
        <PhotoViewer
          urls={viewerUrls}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
        />
      )}

      <GymAllMachinesScreen
        visible={showAllMachines}
        gymId={gym.id}
        gymName={gym.name}
        machines={gym.machines}
        onClose={() => setShowAllMachines(false)}
      />

      {/* ── 정보 제보 modal ── */}
      <Modal
        visible={showReport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReport(false)}
      >
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.repHeader}>
              <TouchableOpacity style={s.repHeaderBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowReport(false); }} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={C.text} />
              </TouchableOpacity>
              <Text style={s.repHeaderTitle}>정보 제보하기</Text>
              <View style={s.repHeaderBtn} />
            </View>

            {reportSent ? (
              <View style={s.repSentWrap}>
                <Ionicons name="checkmark-circle" size={60} color={C.accent} />
                <Text style={s.repSentTitle}>제보해 주셔서 감사해요!</Text>
                <Text style={s.repSentBody}>검토 후 정보를 업데이트할게요.</Text>
                <TouchableOpacity style={s.repSentBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowReport(false); }} activeOpacity={0.85}>
                  <Text style={s.repSentBtnText}>확인</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={s.repScroll} keyboardShouldPersistTaps="handled">
                <Text style={s.repDesc}>잘못된 정보를 발견하셨나요? 제보해 주시면 검토 후 반영하겠습니다.</Text>

                <Text style={s.repFieldLabel}>제보 유형</Text>
                <View style={s.repTypeRow}>
                  {([
                    { key: 'wrong_hours',   label: '운영시간 오류' },
                    { key: 'wrong_address', label: '주소 오류' },
                    { key: 'wrong_phone',   label: '전화번호 오류' },
                    { key: 'closed',        label: '폐업' },
                    { key: 'other',         label: '기타' },
                  ] as { key: GymReportType; label: string }[]).map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.repTypeChip, reportType === t.key && s.repTypeChipActive]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReportType(t.key); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.repTypeChipText, reportType === t.key && s.repTypeChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.repFieldLabel}>상세 내용</Text>
                <TextInput
                  style={s.repInput}
                  value={reportMsg}
                  onChangeText={v => setReportMsg(v)}
                  placeholder="정확한 정보를 알고 계신다면 알려주세요."
                  placeholderTextColor={C.textDim}
                  multiline
                  numberOfLines={4}
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[s.repSubmitBtn, reportLoading && { opacity: 0.6 }]}
                  activeOpacity={0.85}
                  disabled={reportLoading}
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const banned = await containsBannedWord(reportMsg);
                    if (banned) {
                      Alert.alert('사용 불가', '사용할 수 없는 단어가 포함되어 있어요.');
                      return;
                    }
                    setReportLoading(true);
                    const { error: reportError } = await submitGymInfoReport({
                      gymId: gym.id,
                      gymName: gym.name,
                      reporterUserId: user?.id,
                      reportType,
                      content: reportMsg.trim() || reportType,
                    });
                    setReportLoading(false);
                    if (reportError) {
                      Alert.alert('제보 실패', '잠시 후 다시 시도해주세요.');
                      return;
                    }
                    setReportSent(true);
                  }}
                >
                  <Text style={s.repSubmitBtnText}>{reportLoading ? '제출 중...' : '제보 보내기'}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

// --- Styles

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Report button
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginTop: 24, marginBottom: 4,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: 1, borderColor: C.border,
  },
  reportBtnText: { fontSize: 12, color: C.textDim, fontWeight: '600' },

  // Report modal
  repHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  repHeaderBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  repHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.text },

  repScroll: { padding: 20 },
  repDesc:   { fontSize: 13, color: C.textSub, lineHeight: 20, marginBottom: 20 },

  repFieldLabel: {
    fontSize: 11, fontWeight: '700', color: C.textDim,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 4,
  },
  repTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  repTypeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  repTypeChipActive:     { backgroundColor: C.accentBg, borderColor: C.accent },
  repTypeChipText:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  repTypeChipTextActive: { color: C.accent },

  repInput: {
    backgroundColor: C.surface,
    borderRadius: R.inner,
    paddingHorizontal: 16, paddingVertical: 14,
    color: C.text, fontSize: 14,
    minHeight: 110,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 20,
  },
  repSubmitBtn: {
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 15,
    alignItems: 'center',
  },
  repSubmitBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  repSentWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 12,
  },
  repSentTitle: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  repSentBody:  { fontSize: 14, color: C.textSub, textAlign: 'center' },
  repSentBtn: {
    marginTop: 24, backgroundColor: C.accent,
    borderRadius: R.btn, paddingVertical: 14, paddingHorizontal: 48,
  },
  repSentBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  // Nav
  navHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  navBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.pill,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: R.pill,
    alignItems: 'center',
  },
  tabBtnActive:     { backgroundColor: C.accent },
  tabBtnText:       { ...T.label, color: C.textSub, fontWeight: '600' },
  tabBtnTextActive: { color: C.bg, fontWeight: '700' },

  // Photo strip
  photoStrip: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 20 },
  photoCard:  {
    flex: 1, height: 110, borderRadius: R.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  // Gym header
  gymHeader: { marginBottom: 18 },
  gymName:   { fontSize: 26, fontWeight: '900', color: C.text, letterSpacing: -0.6 },
  gymLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  gymLoc:    { fontSize: 13, color: C.textSub },
  managerBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: '#4A90E218', borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  managerBadgeText: { fontSize: 11, fontWeight: '700', color: '#4A90E2' },

  // Info card
  infoCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 20,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center',
  },
  infoText: { fontSize: 14, color: C.text },

  // Section title
  sectionTitle: { ...T.section, color: C.text, marginBottom: 10 },

  // Generic card
  card: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 20,
  },

  // Hours
  hoursTable:    {},
  hoursRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  hoursRowBorder:{ borderTopWidth: 1, borderTopColor: C.border },
  hoursDayWrap:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  hoursDay:      { fontSize: 14, fontWeight: '600', color: C.textSub, width: 40 },
  hoursDayToday: { color: C.text, fontWeight: '800' },
  hoursTime:     { fontSize: 14, color: C.textSub },
  hoursTimeToday:{ color: C.accent, fontWeight: '700' },
  hoursClosed:   { fontSize: 13, color: C.danger, fontWeight: '700' },

  // Notices
  noticeRow:      { padding: 14 },
  noticeBorder:   { borderTopWidth: 1, borderTopColor: C.border },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  noticeTitle:    { flex: 1, fontSize: 13, fontWeight: '800', color: C.text },
  noticeDate:     { fontSize: 10, color: C.textDim, fontWeight: '600' },
  noticeBody:     { fontSize: 13, color: C.textSub, lineHeight: 20 },

  // Pricing
  priceRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  priceBorder:{ borderTopWidth: 1, borderTopColor: C.border },
  priceLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  priceNote:  { fontSize: 11, color: C.textDim, marginTop: 2 },
  priceValue: { fontSize: 16, fontWeight: '900', color: C.accent },

  // Equipment (정보 tab)
  equipCount:  { fontSize: 12, color: C.textDim, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  equipRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  equipBorder: { borderTopWidth: 1, borderTopColor: C.border },
  equipDot:    { width: 7, height: 7, borderRadius: 4 },
  equipName:   { fontSize: 13, fontWeight: '700', color: C.text },
  equipMeta:   { fontSize: 11, color: C.textSub, marginTop: 2 },
  equipCatPill:{ backgroundColor: C.surfaceHigh, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 },
  equipCatText:{ fontSize: 10, fontWeight: '700', color: C.textSub },
  allMachinesBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 14,
  },
  allMachinesBtnText: { fontSize: 13, fontWeight: '700', color: C.accent },

  // 머신 tab
  favFilterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 4,
  },
  favChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  favChipActive:     { backgroundColor: C.accent, borderColor: C.accent },
  favChipText:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  favChipTextActive: { color: C.bg },

  filterRow:            { paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  filterChip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginHorizontal: 4 },
  filterChipActive:     { backgroundColor: C.accentBg, borderColor: C.accent },
  filterChipText:       { fontSize: 12, fontWeight: '600', color: C.textSub },
  filterChipTextActive: { color: C.accent },

  machineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 32 },
  emptyState:  { alignItems: 'center', paddingVertical: 48 },
  emptyText:   { fontSize: 14, color: C.textDim, marginTop: 12 },
});
