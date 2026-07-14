import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, R, T } from '../theme';
import { btnHeight, cardPadH, cardPadV, iconSize, screenPad } from '../theme/responsive';
import GymDetailModal from './flow/GymDetailModal';
import ManagerOnboardingModal from './manager/ManagerOnboardingModal';
import { useAuth } from '../context/AuthContext';

import { WorkoutLog, WorkoutFeedPost, UserSplitConfig, WeekdaySplit } from '../data/types';
import { fetchWorkoutLogs } from '../lib/db';
import { fetchActiveFeedPosts } from '../lib/db/feedPosts';
import { fetchSplitConfig } from '../lib/db/splitRoutine';
import { getTodayTarget, getTodayTargets, toEnMuscle, toKoMuscle } from '../lib/splitUtils';
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
const OUNWAN_CARD_GAP = 10;

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

const OunwanCard = React.memo(({ post, onPress }: {
  post:    WorkoutFeedPost;
  onPress: () => void;
}) => {
  const displayUri = post.photoUri ?? post.compositeUri;
  const [cardH, setCardH] = useState(Math.round(OUNWAN_CARD_W * 3 / 4));

  useEffect(() => {
    if (!displayUri) return;
    Image.getSize(
      displayUri,
      (w, h) => { if (w > 0 && h > 0) setCardH(Math.round(OUNWAN_CARD_W * (h / w))); },
      () => {}
    );
  }, [displayUri]);

  return (
    <TouchableOpacity
      style={[st.ounwanCardOuter, { height: cardH }]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={st.ounwanCardInner}>
        {displayUri ? (
          <ExpoImage
            source={{ uri: displayUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
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

  // Only depends on posts.length — no useCallback chain
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (posts.length <= 1) return;
    const STEP = OUNWAN_CARD_W + OUNWAN_CARD_GAP;
    intervalRef.current = setInterval(() => {
      currentIdx.current = (currentIdx.current + 1) % postsLenRef.current;
      scrollRef.current?.scrollTo({ x: currentIdx.current * STEP, animated: true });
    }, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [posts.length]);

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
    }, 2500);
  }, []);

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
  const { user, markManagerOnboarded } = useAuth();
  const nav = useNavigation<any>();
  const [gymDetailVisible, setGymDetailVisible] = useState(false);
  const [gymDetailId,      setGymDetailId]      = useState<string | null>(null);
  const [sessions,         setSessions]          = useState<WorkoutLog[]>([]);
  const [splitConfig,      setSplitConfig]       = useState<UserSplitConfig | null>(null);
  const [todayTarget,      setTodayTarget]       = useState<string | null>(null);
  const [ounwanPosts,        setOunwanPosts]         = useState<WorkoutFeedPost[]>([]);
  const [weekTargetMap,      setWeekTargetMap]       = useState<Record<string, string | null>>({});
  const [ounwanDisplayTarget, setOunwanDisplayTarget] = useState<string | null>(null);

  const [showManagerOnboarding, setShowManagerOnboarding] = useState(false);

  // 매니저 첫 로그인 온보딩: role === 'manager' && managerOnboarded === false 일 때 1회 표시
  useEffect(() => {
    if (user?.role === 'manager' && user?.managerOnboarded === false) {
      setShowManagerOnboarding(true);
    }
  }, [user?.id, user?.role, user?.managerOnboarded]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        let target: string | null = null;
        let todayTargetsArr: string[] = [];

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

            const posts = await fetchActiveFeedPosts().catch(() => [] as WorkoutFeedPost[]);
            if (!active) return;

            if (todayMuscles.length > 0) {
              const filtered = posts.filter(p => p.muscles.some(m => todayMuscles.includes(m)));
              setOunwanPosts(filtered.length > 0 ? filtered : posts);
            } else {
              setOunwanPosts(posts);
            }

            setTodayTarget(target);
            setOunwanDisplayTarget(todayMuscles.length > 0 ? todayMuscles.map(toKoMuscle).join(', ') : (todayTargetsArr.join(', ') || null));
            const weekDates = getThisWeekDates();
            setWeekTargetMap(getWeekTargetMap(config, weekDates));
            return;
          }

          target = config
            ? getTodayTarget(config.splitType, config.workoutSplit, config.splitCurrentIndex)
            : null;
          setTodayTarget(target);
          setOunwanDisplayTarget(todayTargetsArr.join(', ') || null);

          const weekDates = getThisWeekDates();
          setWeekTargetMap(getWeekTargetMap(config, weekDates));
        }

        const posts = await fetchActiveFeedPosts().catch(() => [] as WorkoutFeedPost[]);
        if (!active) return;

        if (todayTargetsArr.length > 0) {
          const targetsEn = todayTargetsArr.map(toEnMuscle);
          const filtered = posts.filter(p => p.muscles.some(m => targetsEn.includes(m)));
          setOunwanPosts(filtered.length > 0 ? filtered : posts);
        } else {
          setOunwanPosts(posts);
        }
      }
      load();
      return () => { active = false; };
    }, [user?.id])
  );

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
                const photoSrc = session?.compositeUri ?? session?.photoUri;
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
                        <Image
                          source={{ uri: photoSrc }}
                          style={st.weekThumbImg}
                          resizeMode="cover"
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
            ounwanDisplayTarget && ounwanDisplayTarget !== '휴식'
              ? `오늘 ${ounwanDisplayTarget} 운동한 사람들이에요! 💪`
              : '오늘 운동한 사람들이에요! 💪'
          }
          onMorePress={handleFeedPress}
        />
        <AutoScrollOunwan posts={ounwanPosts} onPressPost={handleFeedPress} />

        <View style={{ height: 32 }} />
      </ScrollView>

      <GymDetailModal
        visible={gymDetailVisible}
        gymId={gymDetailId}
        onClose={() => setGymDetailVisible(false)}
      />

      <ManagerOnboardingModal
        visible={showManagerOnboarding}
        onComplete={() => {
          setShowManagerOnboarding(false);
          markManagerOnboarded();
        }}
        onFinish={() => nav.navigate('Profile')}
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
