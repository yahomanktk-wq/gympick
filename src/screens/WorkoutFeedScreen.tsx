import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  PixelRatio,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { WorkoutFeedPost, WorkoutLog } from '../data/types';
const MOCK_FEED_POSTS: WorkoutFeedPost[] = [];
import { filterActivePosts, filterByGym, filterByDistance, toggleReaction, convertSessionToFeedPost } from '../lib/feedUtils';
import { fetchMyLatestGymId, fetchFeedPostsByGym } from '../lib/db/feedPosts';
import { getActiveFeedPostsCached } from '../data/feedPostsCache';
import { fetchActiveFeedPosts } from '../lib/db/feedPosts';
import { fetchSplitConfig } from '../lib/db/splitRoutine';
import { getTodayTarget, toEnMuscle } from '../lib/splitUtils';
import { fetchWorkoutLogs } from '../lib/db/workouts';
import { useAuth } from '../context/AuthContext';
import GymDetailModal from './flow/GymDetailModal';
import MachineDetailModal from './flow/MachineDetailModal';
import FeedDetailModal from '../components/feed/FeedDetailModal';
import { MACHINES } from '../data';
import { getTransformedImageUrl } from '../lib/photoImageUrl';

// ── 상수 ─────────────────────────────────────────────────────────────────────

const SCREEN_W    = Dimensions.get('window').width;
const GRID_GAP    = 8;
const GRID_PAD    = 16;
const GRID_CARD_W = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP) / 2);
const IMAGE_PIXEL_RATIO = PixelRatio.get();

const MUSCLE_FILTERS = ['전체', '가슴', '등', '하체', '어깨', '팔'] as const;
type MuscleFilter = (typeof MUSCLE_FILTERS)[number];

// ── 최신순 정렬 ───────────────────────────────────────────────────────────────

function sortByLatest(posts: WorkoutFeedPost[]): WorkoutFeedPost[] {
  return [...posts].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ── 내 포스트 항상 포함 헬퍼 ──────────────────────────────────────────────────

function filterWithMyPosts(
  allPosts: WorkoutFeedPost[],
  filtered: WorkoutFeedPost[],
): WorkoutFeedPost[] {
  const myPosts  = allPosts.filter(p => p.isMyPost);
  const combined = [...myPosts, ...filtered.filter(p => !p.isMyPost)];
  const unique   = combined.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
  return sortByLatest(unique);
}

// ── 탭 정의 ──────────────────────────────────────────────────────────────────

type FeedTab = '내 헬스장' | '주변 5km' | '전국';
const TABS: FeedTab[] = ['내 헬스장', '주변 5km', '전국'];

// ── Sub-components ────────────────────────────────────────────────────────────

function TabSegment({
  tabs, active, onPress,
}: {
  tabs: FeedTab[]; active: FeedTab; onPress: (t: FeedTab) => void;
}) {
  return (
    <View style={s.tabRow}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t}
          style={[s.tabBtn, active === t && s.tabBtnActive]}
          onPress={() => onPress(t)}
          activeOpacity={0.75}
        >
          <Text style={[s.tabLabel, active === t && s.tabLabelActive]}>{t}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EmptyState({ tab, isFallback }: { tab: FeedTab; isFallback?: boolean }) {
  const msg =
    tab === '내 헬스장' ? '최근 방문한 헬스장의 오운완이 없어요' :
    tab === '주변 5km'  ? '주변 5km 내 오운완이 없어요' :
    isFallback          ? '최근 등록된 오운완이 없어요' :
                          '오늘 등록된 오운완이 없어요';
  return (
    <View style={s.empty}>
      <Ionicons name="image-outline" size={44} color={C.textDim} />
      <Text style={s.emptyText}>{msg}</Text>
    </View>
  );
}

// ── 그리드 카드 ───────────────────────────────────────────────────────────────

function FeedGridCard({
  post,
  width,
  onPress,
}: {
  post:    WorkoutFeedPost;
  width:   number;
  onPress: () => void;
}) {
  const CARD_H = Math.round(width * 4 / 3);
  const rawUri = post.thumbnailUri ?? post.compositeUri ?? post.photoUri;
  const displayUri = getTransformedImageUrl(rawUri, {
    width:  Math.round(width * IMAGE_PIXEL_RATIO),
    height: Math.round(CARD_H * IMAGE_PIXEL_RATIO),
  });

  return (
    <TouchableOpacity
      style={{ width, backgroundColor: C.surface }}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: displayUri }}
        style={{ width, height: CARD_H }}
        contentFit="cover"
        cachePolicy="memory-disk"
        placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
        transition={200}
      />
      {post.isMyPost && (
        <View style={{
          position: 'absolute', top: 8, left: 8,
          backgroundColor: '#000000', borderRadius: 6,
          paddingHorizontal: 7, paddingVertical: 2,
        }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: C.accent }}>내 오운완</Text>
        </View>
      )}
      <View style={{
        position: 'absolute', top: 8, right: 8,
        backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: R.pill,
        paddingHorizontal: 6, paddingVertical: 2,
      }}>
        <Text style={{ fontSize: 9, color: '#CCCCCC', fontWeight: '500' }}>
          {(() => {
            const diffMs  = Date.now() - new Date(post.createdAt).getTime();
            const diffH   = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMin = Math.floor(diffMs / (1000 * 60));
            if (diffMin < 1)  return '방금 전';
            if (diffH < 1)    return `${diffMin}분 후 사라져요`;
            if (diffH < 24)   return `${24 - diffH}시간 후 사라져요`;
            const diffDays = Math.floor(diffH / 24);
            return `${diffDays}일 전`;
          })()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WorkoutFeedScreen() {
  const nav      = useNavigation<any>();
  const { user } = useAuth();
  const [activeTab,    setActiveTab]    = useState<FeedTab>('전국');
  const [posts,        setPosts]        = useState<WorkoutFeedPost[]>([]);
  const [myGymId,      setMyGymId]      = useState<string | null>(null);
  const [myGymName,    setMyGymName]    = useState<string>('내 헬스장');
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>('전체');
  const [isFeedFallback, setIsFeedFallback] = useState(false);
  const [detailPost,       setDetailPost]       = useState<WorkoutFeedPost | null>(null);
  const [gymDetailId,      setGymDetailId]      = useState<string | null>(null);
  const [machineDetailItem, setMachineDetailItem] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadFilter = async () => {
      const [config, logs] = await Promise.all([
        fetchSplitConfig(user.id).catch(() => null),
        fetchWorkoutLogs(user.id).catch(() => []),
      ]);

      // 오늘 운동일지 확인
      const todayStr  = new Date().toDateString();
      const todayLogs = logs.filter((l: any) =>
        new Date(l.date).toDateString() === todayStr
      );

      let targetKo: string | null = null;

      if (todayLogs.length > 0) {
        // 오늘 일지 있음 → 일지 타겟 부위(영어)를 한글로 변환
        const { toKoMuscle } = await import('../lib/splitUtils');
        const todayMuscleEn  = todayLogs[0].targetMuscles?.[0] ?? null;
        targetKo = todayMuscleEn ? toKoMuscle(todayMuscleEn) : null;
      } else if (config) {
        // 오늘 일지 없음 → 현재 인덱스 타겟 부위
        targetKo = getTodayTarget(config.splitType, config.workoutSplit, config.splitCurrentIndex);
      }

      if (
        targetKo &&
        targetKo !== '휴식' &&
        (MUSCLE_FILTERS as readonly string[]).includes(targetKo)
      ) {
        setMuscleFilter(targetKo as MuscleFilter);
      }
    };

    loadFilter();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadPosts() {
        if (active) setIsFeedFallback(false);
        if (!user?.id) {
          let serverPosts = await getActiveFeedPostsCached().catch(() => [] as WorkoutFeedPost[]);
          if (serverPosts.length < 3) {
            const widened = await fetchActiveFeedPosts(null).catch(() => [] as WorkoutFeedPost[]);
            if (widened.length > serverPosts.length) {
              serverPosts = widened;
              if (active) setIsFeedFallback(true);
            }
          }
          const previewPosts = serverPosts.slice(0, 4);
          if (active) setPosts(previewPosts);
          return;
        }
        const myUserId = user.id;

        // 운동기록 / 최근 헬스장 ID / 피드 게시물 조회는 서로 결과를 필요로 하지 않는
        // 독립적인 조회이므로 동시에 시작한다 (순서대로 기다리던 것을 병렬화).
        const [mySessions, fetchedGymId, initialServerPosts]: [WorkoutLog[], string | null, WorkoutFeedPost[]] = await Promise.all([
          fetchWorkoutLogs(user.id).catch(() => [] as WorkoutLog[]),
          fetchMyLatestGymId(user.id),
          getActiveFeedPostsCached().catch(() => [] as WorkoutFeedPost[]),
        ]);

        // 24시간 이내 세션만 필터링
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recentSessions = mySessions.filter(
          s => new Date(s.date).getTime() >= cutoff
        );

        // 가장 최근 운동한 헬스장 ID
        let latestGymId: string | null = fetchedGymId;
        if (!latestGymId && mySessions.length > 0) {
          const sorted = [...mySessions].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          latestGymId = sorted[0].gymId ?? null;
        }
        if (active) setMyGymId(latestGymId);

        if (latestGymId && mySessions.length > 0) {
          const recent = mySessions.find(s => s.gymId === latestGymId);
          if (recent?.gymName && active) setMyGymName(recent.gymName);
        }

        let serverPosts = initialServerPosts;
        if (serverPosts.length < 3) {
          const widened = await fetchActiveFeedPosts(null).catch(() => [] as WorkoutFeedPost[]);
          if (widened.length > serverPosts.length) {
            serverPosts = widened;
            if (active) setIsFeedFallback(true);
          }
        }

        // 내 게시물: serverPosts에서 가져옴 (routineCardUri 포함)
        // serverPosts가 없으면 로컬 세션으로 fallback
        const serverMyPosts = serverPosts
          .filter(p => p.userId === myUserId)
          .map(p => ({ ...p, isMyPost: true }));

        const myPosts = serverMyPosts.length > 0
          ? serverMyPosts
          : recentSessions
              .map(session => convertSessionToFeedPost(
                session,
                user.id,
                user?.nickname ?? user?.name ?? 'me',
                latestGymId ?? 'g01',
              ))
              .filter((p): p is WorkoutFeedPost => p !== null);

        const otherPosts = (serverPosts.length === 0
          ? filterActivePosts(MOCK_FEED_POSTS)
          : serverPosts
        ).filter(p => p.userId !== myUserId);

        const combined = [...myPosts, ...otherPosts];
        const unique   = combined.filter((p, i, arr) =>
          arr.findIndex(x => x.id === p.id) === i
        );
        if (active) setPosts(sortByLatest(unique));
      }

      loadPosts();
      return () => { active = false; };
    }, [user])
  );

  const filtered = useMemo(() => {
    // 탭 필터
    let base: WorkoutFeedPost[];
    if (activeTab === '내 헬스장') {
      base = !myGymId
        ? posts.filter(p => p.isMyPost)
        : filterWithMyPosts(posts, filterByGym(posts, myGymId));
    } else if (activeTab === '주변 5km') {
      base = filterWithMyPosts(posts, filterByDistance(posts, 5));
    } else {
      base = sortByLatest(posts);
    }

    // 부위 필터 (muscleFilter는 한글, p.muscles는 영어이므로 변환 후 비교)
    if (muscleFilter === '전체') return base;
    const targetEn = toEnMuscle(muscleFilter);
    return base.filter(p => p.muscles.some(m => m === targetEn));
  }, [posts, activeTab, myGymId, muscleFilter]);

  const handleReact = useCallback((postId: string, key: keyof WorkoutFeedPost['reactions']) => {
    setPosts(prev => prev.map(p => p.id === postId ? toggleReaction(p, key) : p));
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>{isFeedFallback ? '최근 오운완' : '오늘의 오운완'}</Text>
        <View style={{ width: 38 }} />
      </View>

      <TabSegment tabs={TABS} active={activeTab} onPress={setActiveTab} />

      {/* 타겟부위 필터칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        style={{ marginBottom: 8, flexGrow: 0, height: 44 }}
      >
        {MUSCLE_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              s.filterChip,
              muscleFilter === filter && s.filterChipActive,
            ]}
            onPress={() => setMuscleFilter(filter)}
            activeOpacity={0.8}
          >
            <Text style={[
              s.filterChipText,
              muscleFilter === filter && s.filterChipTextActive,
            ]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState tab={activeTab} isFallback={isFeedFallback} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: GRID_PAD }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 32, gap: GRID_GAP }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={true}
          renderItem={({ item }) => (
            <FeedGridCard
              post={item}
              width={GRID_CARD_W}
              onPress={() => setDetailPost(item)}
            />
          )}
          ListFooterComponent={() => (
            <>
              {!user?.id && posts.length > 0 && (
                <TouchableOpacity
                  style={s.loginPromptBanner}
                  onPress={() => nav.navigate('Main', { screen: 'Profile' })}
                  activeOpacity={0.85}
                >
                  <View style={s.loginPromptInner}>
                    <Ionicons name="lock-closed-outline" size={20} color={C.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.loginPromptTitle}>더 많은 오운완을 보려면 로그인하세요</Text>
                      <Text style={s.loginPromptSub}>로그인하면 내 헬스장, 주변 운동 친구들의 오운완을 볼 수 있어요</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.accent} />
                  </View>
                </TouchableOpacity>
              )}
              <View style={{ height: 40 }} />
            </>
          )}
        />
      )}

      {/* 상세 모달 */}
      {detailPost && (
        <FeedDetailModal
          post={detailPost}
          onClose={() => setDetailPost(null)}
          onReact={(postId, key) => {
            handleReact(postId, key);
            setDetailPost(prev => prev ? { ...prev, ...toggleReaction(prev, key) } : prev);
          }}
          onPressGym={(gymId) => {
            setDetailPost(null);
            setTimeout(() => setGymDetailId(gymId), 350);
          }}
          onPressMachine={(machineId) => {
            const machine = MACHINES.find(m => m.id === machineId);
            if (machine) {
              setDetailPost(null);
              setTimeout(() => setMachineDetailItem(machine), 350);
            }
          }}
        />
      )}

      <GymDetailModal
        visible={!!gymDetailId}
        gymId={gymDetailId}
        onClose={() => setGymDetailId(null)}
      />

      <MachineDetailModal
        visible={!!machineDetailItem}
        machine={machineDetailItem}
        onClose={() => setMachineDetailItem(null)}
        onSelectGym={(gymId) => {
          setMachineDetailItem(null);
          setTimeout(() => setGymDetailId(gymId), 350);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    borderRadius: R.inner, backgroundColor: C.surface,
  },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.surface, borderRadius: R.inner, padding: 3,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: R.inner - 2,
  },
  tabBtnActive:   { backgroundColor: C.bg },
  tabLabel:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  tabLabelActive: { color: C.text, fontWeight: '800' },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingBottom: 60,
  },
  emptyText: { fontSize: 14, color: C.textDim, fontWeight: '500' },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical:   0,
    height:            36,
    justifyContent:    'center',
    alignItems:        'center',
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
  },
  filterChipActive:     { backgroundColor: C.accent, borderColor: C.accent },
  filterChipText:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  filterChipTextActive: { color: C.bg },

  loginPromptBanner: {
    marginHorizontal: 16,
    marginBottom:     16,
    borderRadius:     R.card,
    backgroundColor:  C.accentBg,
    borderWidth:      1,
    borderColor:      C.accent + '40',
    overflow:         'hidden',
  },
  loginPromptInner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    padding:        16,
  },
  loginPromptTitle: {
    fontSize:     14,
    fontWeight:   '700',
    color:        C.text,
    marginBottom: 4,
  },
  loginPromptSub: {
    fontSize:   12,
    color:      C.textSub,
    lineHeight: 17,
  },
});
