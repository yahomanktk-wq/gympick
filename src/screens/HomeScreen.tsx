import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  PixelRatio,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, R, T } from '../theme';
import { btnHeight, cardPadH, cardPadV, iconSize, screenPad } from '../theme/responsive';
import GymDetailModal from './flow/GymDetailModal';
import HomeRankingSections from '../components/HomeRankingSections';
import RecentWorkoutSummaryPopup from '../components/RecentWorkoutSummaryPopup';
import {
  pickRecentWorkoutForPopup,
  hasSeenRecentWorkoutPopupToday,
  markRecentWorkoutPopupSeenToday,
  type RecentWorkoutPopupPick,
} from '../lib/recentWorkoutPopup';
import { useAuth } from '../context/AuthContext';

import { WorkoutLog, WorkoutFeedPost, UserSplitConfig, WeekdaySplit } from '../data/types';
import { fetchWorkoutLogs } from '../lib/db';
import { getActiveFeedPostsCached } from '../data/feedPostsCache';
import { fetchActiveFeedPosts } from '../lib/db/feedPosts';
import { fetchSplitConfig } from '../lib/db/splitRoutine';
import { getTodayTarget, getTodayTargets, toEnMuscle, toKoMuscle } from '../lib/splitUtils';
import { getTransformedImageUrl } from '../lib/photoImageUrl';
import { track } from '../lib/analytics';
import { perfStart, perfEnd } from '../lib/perf';
import * as Haptics from 'expo-haptics';

// --- Helpers

function getThisWeekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

function getThisWeekDates(): Date[] {
  const monday = getThisWeekStart();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getWeekTargetMap(
  splitConfig: UserSplitConfig | null,
  weekDates: Date[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  if (!splitConfig || !splitConfig.workoutSplit) {
    weekDates.forEach(d => { result[d.toDateString()] = null; });
    return result;
  }

  if (splitConfig.splitType === 'weekday') {
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const split = splitConfig.workoutSplit as WeekdaySplit;
    weekDates.forEach(d => {
      const key = DAY_KEYS[d.getDay()] as keyof WeekdaySplit;
      const targets = (split[key] ?? []) as string[];
      const work = targets.filter(m => m !== '휴식');
      result[d.toDateString()] = work.length > 0 ? work.join('·') : (targets.length > 0 ? '휴식' : null);
    });
    return result;
  }

  // sequential: assign from today onwards
  const split = splitConfig.workoutSplit as string[][];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let idx = splitConfig.splitCurrentIndex;

  weekDates.forEach(d => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    if (date < today) {
      result[d.toDateString()] = null;
    } else {
      const slot = split[idx % split.length] ?? [];
      const work = slot.filter(m => m !== '휴식');
      result[d.toDateString()] = work.length > 0 ? work.join('·') : (slot.length > 0 ? '휴식' : null);
      idx++;
    }
  });

  return result;
}

const { width: SCREEN_W } = Dimensions.get('window');
const HOME_THUMB_W   = Math.floor((SCREEN_W - 32) / 3.5);
const HOME_THUMB_H   = Math.round(HOME_THUMB_W * (4 / 3));
const OUNWAN_CARD_W  = 160;
const OUNWAN_CARD_H  = Math.round(OUNWAN_CARD_W * (4 / 3));
const OUNWAN_CARD_GAP = 10;
const IMAGE_PIXEL_RATIO = PixelRatio.get();

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 17) return '안녕하세요';
  return '좋은 저녁이에요';
}

// 로컬(KST) 달력일 기준 키 — isSameDay와 동일한 방식(local Date 컴포넌트)으로 통일
function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeStreak(logs: WorkoutLog[]): number {
  if (!logs.length) return 0;
  const uniqueDates = [...new Set(logs.map(l => localDayKey(new Date(l.date))))].sort().reverse();
  if (!uniqueDates.length) return 0;

  // 가장 최근 기록이 오늘 또는 어제가 아니면 스트릭은 이미 끊긴 것
  const today = new Date();
  const todayStr = localDayKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDayKey(yesterday);

  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const [py, pm, pd] = uniqueDates[i - 1].split('-').map(Number);
    const prev = new Date(py, pm - 1, pd);
    prev.setDate(prev.getDate() - 1);
    if (uniqueDates[i] === localDayKey(prev)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── OunwanCard ────────────────────────────────────────────────────────────────

function getOunwanDisplayUri(post: WorkoutFeedPost): string | undefined {
  const raw = post.thumbnailUri ?? post.photoUri ?? post.compositeUri;
  return getTransformedImageUrl(raw, {
    width:  Math.round(OUNWAN_CARD_W * IMAGE_PIXEL_RATIO),
    height: Math.round(OUNWAN_CARD_H * IMAGE_PIXEL_RATIO),
  });
}

const OunwanCard = React.memo(({ post, onPress }: {
  post:    WorkoutFeedPost;
  onPress: () => void;
}) => {
  const displayUri = getOunwanDisplayUri(post);

  return (
    <TouchableOpacity
      style={[st.ounwanCardOuter, { height: OUNWAN_CARD_H }]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={st.ounwanCardInner}>
        {displayUri ? (
          <ExpoImage
            source={{ uri: displayUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: C.surfaceHigh }]} />
        )}
      </View>
    </TouchableOpacity>
  );
});

// ── AutoScrollOunwan ──────────────────────────────────────────────────────────

const AutoScrollOunwan = React.memo(({ posts, onPressPost }: {
  posts:       WorkoutFeedPost[];
  onPressPost: () => void;
}) => {
  const scrollRef   = useRef<ScrollView>(null);
  const currentIdx  = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref so setInterval callback always reads the latest length without being a dep
  const postsLenRef = useRef(posts.length);
  postsLenRef.current = posts.length;
  // Always-latest posts array for prefetching (posts prop may change identity on re-render)
  const postsRef = useRef(posts);
  postsRef.current = posts;

  // Prefetch the next 1~2 cards' display images so scrolling doesn't stall on load
  const prefetchAround = useCallback((idx: number) => {
    const list = postsRef.current;
    if (list.length === 0) return;
    for (let offset = 1; offset <= 2; offset++) {
      const target = list[(idx + offset) % list.length];
      const uri = target ? getOunwanDisplayUri(target) : undefined;
      if (uri) {
        ExpoImage.prefetch(uri).catch(() => {});
      }
    }
  }, []);

  // Only depends on posts.length — no useCallback chain
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (posts.length <= 1) return;
    prefetchAround(currentIdx.current);
    const STEP = OUNWAN_CARD_W + OUNWAN_CARD_GAP;
    intervalRef.current = setInterval(() => {
      currentIdx.current = (currentIdx.current + 1) % postsLenRef.current;
      scrollRef.current?.scrollTo({ x: currentIdx.current * STEP, animated: true });
      prefetchAround(currentIdx.current);
    }, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [posts.length, prefetchAround]);

  // Stable handlers — only read/write refs, no state involved
  const handleScrollBegin = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const handleScrollEnd = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (postsLenRef.current <= 1) return;
    const STEP = OUNWAN_CARD_W + OUNWAN_CARD_GAP;
    intervalRef.current = setInterval(() => {
      currentIdx.current = (currentIdx.current + 1) % postsLenRef.current;
      scrollRef.current?.scrollTo({ x: currentIdx.current * STEP, animated: true });
      prefetchAround(currentIdx.current);
    }, 2500);
  }, [prefetchAround]);

  if (posts.length === 0) {
    return (
      <View style={st.feedEmpty}>
        <Text style={st.feedEmptyText}>아직 오늘의 오운완이 없어요</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      contentContainerStyle={{ gap: OUNWAN_CARD_GAP, paddingHorizontal: 20 }}
      onScrollBeginDrag={handleScrollBegin}
      onScrollEndDrag={handleScrollEnd}
    >
      {posts.map(post => (
        <OunwanCard key={post.id} post={post} onPress={onPressPost} />
      ))}
    </ScrollView>
  );
});

// ── OunwanHeader ─────────────────────────────────────────────────────────────

const ounwanHeaderStyle = {
  flexDirection:  'row' as const,
  alignItems:     'center' as const,
  justifyContent: 'space-between' as const,
  paddingHorizontal: 20,
  marginBottom:   12,
};
const ounwanHeaderTextStyle = {
  flex:       1,
  fontSize:   18,
  fontWeight: '800' as const,
  color:      C.text,
};
const moreBtnStyle = {
  fontSize:   13,
  fontWeight: '600' as const,
  color:      C.accent,
  marginLeft: 8,
};

const OunwanHeader = React.memo(({
  message,
  onMorePress,
}: {
  message:      string;
  onMorePress:  () => void;
}) => (
  <View style={ounwanHeaderStyle}>
    <Text style={ounwanHeaderTextStyle} numberOfLines={1}>
      {message}
    </Text>
    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMorePress(); }} activeOpacity={0.7}>
      <Text style={moreBtnStyle}>더보기</Text>
    </TouchableOpacity>
  </View>
));

// --- Screen

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const nav = useNavigation<any>();
  const [gymDetailVisible, setGymDetailVisible] = useState(false);
  const [gymDetailId,      setGymDetailId]      = useState<string | null>(null);
  const [sessions,         setSessions]          = useState<WorkoutLog[]>([]);
  const [splitConfig,      setSplitConfig]       = useState<UserSplitConfig | null>(null);
  const [todayTarget,      setTodayTarget]       = useState<string | null>(null);
  const [ounwanPosts,        setOunwanPosts]         = useState<WorkoutFeedPost[]>([]);
  const [weekTargetMap,      setWeekTargetMap]       = useState<Record<string, string | null>>({});
  const [ounwanDisplayTarget, setOunwanDisplayTarget] = useState<string | null>(null);
  const [ounwanIsFallback, setOunwanIsFallback] = useState(false);
  const [recentWorkoutPick,    setRecentWorkoutPick]    = useState<RecentWorkoutPopupPick | null>(null);
  const [showRecentWorkoutPopup, setShowRecentWorkoutPopup] = useState(false);

  // 홈 화면 focus마다 최신 role/managerOnboarded를 확인 — 매니저 승인 알림을
  // 직접 탭하지 않아도 홈에 들어올 때마다 승인 여부가 반영되도록 한다.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      refreshUser().catch(() => {});
    }, [user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setOunwanIsFallback(false);
        let target: string | null = null;
        let todayTargetsArr: string[] = [];
        // 오운완 피드를 필터링할 부위 목록 — 분기에 따라 채워지며, 실제 조회는 아래에서 한 번만 한다
        let feedMuscleFilter: string[] = [];
        let hasFeedMuscleFilter = false;

        // 오운완 피드 조회는 아래 운동기록/분할 조회 결과와 무관하므로
        // (필터링은 나중에 별도로 적용됨) 동시에 미리 시작해둔다.
        const feedPostsPromise = getActiveFeedPostsCached().catch(() => [] as WorkoutFeedPost[]);

        if (user) {
          const [logs, config] = await Promise.all([
            fetchWorkoutLogs(user.id).catch(() => [] as WorkoutLog[]),
            fetchSplitConfig(user.id).catch(() => null),
          ]);
          if (!active) return;
          setSessions(logs);
          setSplitConfig(config);
          todayTargetsArr = config
            ? getTodayTargets(config.splitType, config.workoutSplit, config.splitCurrentIndex)
            : [];

          const todayStr = new Date().toDateString();
          const todayLogs = logs.filter(l =>
            new Date(l.date).toDateString() === todayStr
          );

          if (todayLogs.length > 0) {
            const todayMuscles = (todayLogs[0].targetMuscles && todayLogs[0].targetMuscles.length > 0)
              ? todayLogs[0].targetMuscles
              : [...new Set(todayLogs[0].machines.map(m => m.targetMuscle).filter(Boolean))];
            target = config
              ? getTodayTarget(config.splitType, config.workoutSplit, config.splitCurrentIndex)
              : null;

            feedMuscleFilter = todayMuscles;
            hasFeedMuscleFilter = todayMuscles.length > 0;

            setTodayTarget(target);
            setOunwanDisplayTarget(todayMuscles.length > 0 ? todayMuscles.map(toKoMuscle).join(', ') : (todayTargetsArr.join(', ') || null));
            const weekDates = getThisWeekDates();
            setWeekTargetMap(getWeekTargetMap(config, weekDates));
          } else {
            target = config
              ? getTodayTarget(config.splitType, config.workoutSplit, config.splitCurrentIndex)
              : null;
            setTodayTarget(target);
            setOunwanDisplayTarget(todayTargetsArr.join(', ') || null);

            const weekDates = getThisWeekDates();
            setWeekTargetMap(getWeekTargetMap(config, weekDates));

            feedMuscleFilter = todayTargetsArr.map(toEnMuscle);
            hasFeedMuscleFilter = todayTargetsArr.length > 0;
          }
        }

        let posts = await feedPostsPromise;
        if (!active) return;

        // 최근 24시간 게시물이 너무 적으면(3개 미만) 기간 제한 없이 재조회
        // (60초 공유 캐시는 24시간 조회 전용이므로 이 폴백은 캐시를 거치지 않고 직접 호출한다)
        if (posts.length < 3) {
          const widened = await fetchActiveFeedPosts(null).catch(() => [] as WorkoutFeedPost[]);
          if (!active) return;
          if (widened.length > posts.length) {
            posts = widened;
            setOunwanIsFallback(true);
          }
        }

        if (hasFeedMuscleFilter) {
          const filtered = posts.filter(p => p.muscles.some(m => feedMuscleFilter.includes(m)));
          setOunwanPosts(filtered.length > 0 ? filtered : posts);
        } else {
          setOunwanPosts(posts);
        }
      }
      perfStart('HomeScreen:load');
      load().finally(() => perfEnd('HomeScreen:load'));
      return () => { active = false; };
    }, [user?.id])
  );

  // 2026-10-16: 로그인 + 운동일지 작성 경험이 있는 유저에게, 오늘 타겟부위와
  // 겹치는(없으면 가장 최근) 운동일지를 홈 화면 팝업으로 하루 1번만 보여준다.
  // sessions/todayTarget은 위 load()가 이미 불러온 값을 그대로 쓰므로 여기서
  // 추가 네트워크 호출은 하지 않는다.
  useEffect(() => {
    if (!user?.id) return;
    if (sessions.length === 0) return; // 이전에 작성한 운동일지가 없는 유저는 대상 아님

    let cancelled = false;
    (async () => {
      const seen = await hasSeenRecentWorkoutPopupToday(user.id);
      if (cancelled || seen) return;
      const pick = pickRecentWorkoutForPopup(sessions, todayTarget);
      if (!pick || cancelled) return;
      setRecentWorkoutPick(pick);
      setShowRecentWorkoutPopup(true);
      markRecentWorkoutPopupSeenToday(user.id);
    })();
    return () => { cancelled = true; };
  }, [sessions, todayTarget, user?.id]);

  const streak = useMemo(() => computeStreak(sessions), [sessions]);

  const thisWeekSessions = useMemo(() => {
    const ws = getThisWeekStart();
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    return sessions.filter(s => {
      const d = new Date(s.date);
      return d >= ws && d < we;
    });
  }, [sessions]);

  const thisWeekDays = useMemo(() => {
    const ws = getThisWeekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  function openNearby() { nav.navigate('FindGym', { initialTab: 'gym', viewMode: 'map' }); }
  const handleFeedPress = useCallback(() => nav.navigate('WorkoutFeed'), [nav]);
  // "더보기" 버튼 전용 — 개별 오운완 게시물 탭(handleFeedPress)과는 별도로,
  // "더보기" 버튼 탭 횟수만 집계하기 위해 분리함.
  const handleFeedMorePress = useCallback(() => { track('ounwan_more'); nav.navigate('WorkoutFeed'); }, [nav]);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>

        {/* ── Header ── */}
        {user ? (
          <View style={st.header}>
            <View>
              <Text style={st.greet}>{greeting()},</Text>
              <Text style={st.name}>{user.nickname ?? user.name.split(' ')[0]}</Text>
            </View>
            <View style={st.avatar}>
              {user.profileImageUrl ? (
                <ExpoImage
                  source={{ uri: user.profileImageUrl }}
                  style={st.avatarImg}
                  contentFit="cover"
                />
              ) : null}
            </View>
          </View>
        ) : (
          <View style={st.header}>
            <View>
              <Text style={st.greet}>GymPick에 오신 걸 환영해요</Text>
              <Text style={st.guestHeaderSub}>헬스장과 머신을 탐색해보세요.</Text>
            </View>
            <View style={[st.avatar, st.guestAvatar]}>
              <Ionicons name="person-outline" size={20} color={C.textSub} />
            </View>
          </View>
        )}

        {/* ── Streak banner ── */}
        {user && (
          <View style={st.streakBanner}>
            {streak > 0 ? (
              <>
                <Text style={st.streakEmoji}>🔥</Text>
                <Text style={st.streakText}>{streak} 일 연속</Text>
                <Text style={st.streakSub}>계속 유지하세요!</Text>
              </>
            ) : (
              <>
                <Ionicons name="flame-outline" size={16} color={C.textDim} />
                <Text style={st.streakEmpty}>첫 운동을 기록하면 연속 기록이 시작돼요.</Text>
              </>
            )}
          </View>
        )}

        {/* ── 이번 주 운동일지 (retro thumbnail row) ── */}
        {user && (
          <>
            <View style={st.sectionRow}>
              <Text style={st.sectionTitle}>이번 주 운동</Text>
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); nav.navigate('Journal'); }}>
                <Text style={st.seeAll}>더보기</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.weekThumbScroll}
            >
              {thisWeekDays.map((day, i) => {
                const session  = thisWeekSessions.find(s => isSameDay(new Date(s.date), day));
                const today    = new Date();
                const isToday  = isSameDay(day, today);
                const isPast   = !isToday && day < today;
                const isFuture = !isToday && !isPast;
                const photoSrc = getTransformedImageUrl(
                  session?.thumbnailUri ?? session?.compositeUri ?? session?.photoUri,
                  {
                    width:  Math.round(HOME_THUMB_W * IMAGE_PIXEL_RATIO),
                    height: Math.round(HOME_THUMB_H * IMAGE_PIXEL_RATIO),
                  },
                );
                const targetForDay = weekTargetMap[day.toDateString()];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[st.weekThumbCell, isFuture && { opacity: 0.3 }]}
                    activeOpacity={session ? 0.75 : 1}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (session) {
                        nav.navigate('Journal', { openSessionId: session.id });
                      } else {
                        nav.navigate('Journal');
                      }
                    }}
                  >
                    <Text style={[st.weekThumbDayLabel, isToday && { color: C.accent }]}>
                      {['월', '화', '수', '목', '금', '토', '일'][i]}
                    </Text>
                    <View style={[
                      st.weekThumbBox,
                      !photoSrc && st.weekThumbBoxEmpty,
                      isToday && !photoSrc && st.weekThumbBoxToday,
                    ]}>
                      {photoSrc ? (
                        <ExpoImage
                          source={{ uri: photoSrc }}
                          style={st.weekThumbImg}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : session ? (
                        <View style={st.weekThumbEmptyInner}>
                          <View style={st.weekThumbDot} />
                        </View>
                      ) : (
                        <View style={st.weekThumbEmptyInner}>
                          {isPast ? (
                            <Ionicons name="add" size={16} color={C.border} />
                          ) : targetForDay ? (
                            <>
                              <Text style={st.weekThumbDateNum}>{day.getDate()}</Text>
                              <Text style={[
                                st.weekThumbTarget,
                                targetForDay === '휴식' && { color: C.textDim },
                              ]}>
                                {targetForDay}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* ── Guest banner ── */}
        {!user && (
          <TouchableOpacity
            style={st.guestBanner}
            activeOpacity={0.8}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); nav.navigate('Profile'); }}
          >
            <Ionicons name="person-outline" size={15} color={C.accent} />
            <Text style={st.guestBannerText}>
              로그인하고 운동을 기록해보세요.
            </Text>
            <Ionicons name="chevron-forward" size={14} color={C.accent} />
          </TouchableOpacity>
        )}

        {/* ── Find Gym CTA ── */}
        <TouchableOpacity
          style={st.ctaCard}
          activeOpacity={0.88}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); nav.navigate('LogWorkout'); }}
        >
          <View style={st.ctaLeft}>
            <Text style={st.ctaEye}>READY TO LIFT?</Text>
            <Text style={st.ctaTitle}>Find a Gym{'\n'}& Start</Text>
          </View>
          <View style={st.ctaBtn}>
            <Ionicons name="play" size={24} color={C.bg} />
          </View>
        </TouchableOpacity>

        {/* ── 오늘의 오운완 피드 ── */}
        <OunwanHeader
          message={
            ounwanIsFallback
              ? (ounwanDisplayTarget && ounwanDisplayTarget !== '휴식'
                  ? `최근 ${ounwanDisplayTarget} 운동한 사람들이에요! 💪`
                  : '최근 운동한 사람들이에요! 💪')
              : (ounwanDisplayTarget && ounwanDisplayTarget !== '휴식'
                  ? `오늘 ${ounwanDisplayTarget} 운동한 사람들이에요! 💪`
                  : '오늘 운동한 사람들이에요! 💪')
          }
          onMorePress={handleFeedMorePress}
        />
        <AutoScrollOunwan posts={ounwanPosts} onPressPost={handleFeedPress} />

        {/* ── 이번 주 인기 머신 / 인기 헬스장 (2026-09-09: 랭킹 탭에서 이전) ── */}
        <HomeRankingSections />

        <View style={{ height: 32 }} />
      </ScrollView>

      <GymDetailModal
        visible={gymDetailVisible}
        gymId={gymDetailId}
        onClose={() => setGymDetailVisible(false)}
      />

      <RecentWorkoutSummaryPopup
        visible={showRecentWorkoutPopup}
        session={recentWorkoutPick?.session ?? null}
        matchedMuscle={recentWorkoutPick?.matchedMuscle ?? false}
        todayTarget={todayTarget}
        onClose={() => setShowRecentWorkoutPopup(false)}
        onViewDetail={(sessionId) => {
          setShowRecentWorkoutPopup(false);
          nav.navigate('Journal', { openSessionId: sessionId });
        }}
      />
    </SafeAreaView>
  );
}

// --- Styles

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },

  // Ounwan auto-scroll
  ounwanCardOuter: {
    width:           OUNWAN_CARD_W,
    backgroundColor: C.surfaceHigh,
  },
  ounwanCardInner: {
    flex:            1,
    backgroundColor: C.surfaceHigh,
  },

  // Feed empty state
  feedEmpty: {
    marginHorizontal: screenPad,
    marginBottom:     16,
    backgroundColor:  C.surface,
    borderRadius:     R.inner,
    paddingVertical:  20,
    alignItems:       'center',
  },
  feedEmptyText: { fontSize: 13, color: C.textDim },

  // Streak banner
  streakBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginHorizontal:  screenPad,
    marginBottom:      12,
    backgroundColor:   C.accentBg,
    borderRadius:      R.inner,
    paddingHorizontal: cardPadH,
    paddingVertical:   10,
  },
  streakEmoji: { fontSize: 18 },
  streakText:  { fontSize: 15, fontWeight: '800', color: C.accent },
  streakSub:   { fontSize: 12, color: C.accent, opacity: 0.7, marginLeft: 2 },
  streakEmpty: { flex: 1, fontSize: 13, color: C.textDim, lineHeight: 18 },

  // Guest header
  guestHeaderSub: { fontSize: 13, color: C.textSub, fontWeight: '500', marginTop: 4 },
  guestAvatar:    { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },

  // Guest banner
  guestBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginHorizontal:  screenPad,
    marginBottom:      16,
    backgroundColor:   C.accentBg,
    borderRadius:      R.inner,
    paddingHorizontal: cardPadH,
    paddingVertical:   11,
  },
  guestBannerText: { flex: 1, fontSize: 13, color: C.accent, fontWeight: '600' },

  // Header
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-start',
    paddingHorizontal: screenPad,
    paddingTop:        24,
    paddingBottom:     16,
  },
  greet:     { fontSize: 14, color: C.textSub, fontWeight: '500' },
  name:      { fontSize: 30, fontWeight: '900', color: C.text, letterSpacing: -1 },
  avatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },

  // Section headers
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: screenPad, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  sectionHint:  { fontSize: 12, color: C.textDim },
  seeAll:       { fontSize: 13, fontWeight: '700', color: C.accent },

  // Weekly retro thumbnail row
  weekThumbScroll: {
    paddingHorizontal: screenPad,
    gap:               8,
    paddingBottom:     24,
  },
  weekThumbCell: {
    width:      HOME_THUMB_W,
    alignItems: 'center',
    gap:        5,
  },
  weekThumbDayLabel: {
    fontSize:      10,
    fontWeight:    '700',
    color:         C.textDim,
    letterSpacing: 0.3,
  },
  weekThumbBox: {
    width:           HOME_THUMB_W,
    height:          HOME_THUMB_H,
    borderRadius:    10,
    backgroundColor: C.surface,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
  },
  weekThumbBoxEmpty: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  weekThumbBoxToday: {
    borderWidth: 1.5,
    borderColor: C.accent,
    borderStyle: 'solid',
  },
  weekThumbImg:        { width: '100%', height: '100%' },
  weekThumbEmptyInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  weekThumbDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  weekThumbDateNum:    { fontSize: 16, fontWeight: '700', color: C.text },
  weekThumbTarget:     { fontSize: 10, fontWeight: '700', color: C.accent, marginTop: 2 },

  // CTA
  ctaCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  C.surface,
    borderRadius:     R.card,
    marginHorizontal: screenPad,
    marginBottom:     24,
    padding:          cardPadH,
    gap:              16,
  },
  ctaLeft:  { flex: 1 },
  ctaEye:   { fontSize: 9, fontWeight: '900', color: C.accent, letterSpacing: 1.5, marginBottom: 6 },
  ctaTitle: { fontSize: 24, fontWeight: '900', color: C.text, lineHeight: 26, letterSpacing: -0.8 },
  ctaBtn:   { width: btnHeight, height: btnHeight, borderRadius: btnHeight / 2, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
});
