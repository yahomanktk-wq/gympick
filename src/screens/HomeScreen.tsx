import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, R } from '../theme';
import { cardPadH, screenPad } from '../theme/responsive';
import StreakSection from '../components/home/streak/StreakSection';
import OunwanGrid from '../components/home/OunwanGrid';
import GymPickLogo from '../components/GymPickLogo';
import { useAuth } from '../context/AuthContext';

import { WorkoutLog, WorkoutFeedPost, UserSplitConfig, WeekdaySplit } from '../data/types';
import { fetchWorkoutLogs } from '../lib/db';
import { getActiveFeedPostsCached } from '../data/feedPostsCache';
import { fetchActiveFeedPosts } from '../lib/db/feedPosts';
import { fetchSplitConfig } from '../lib/db/splitRoutine';
import { getTodayTargets, toEnMuscle, parseMuscles } from '../lib/splitUtils';
import { getWeekTargetMap } from '../lib/streak/weekTargets';
import { getOunwanImageSources } from '../lib/photoImageUrl';
import FallbackImage from '../components/common/FallbackImage';
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

const { width: SCREEN_W } = Dimensions.get('window');
const HOME_THUMB_W   = Math.floor((SCREEN_W - 32) / 3.5);
const HOME_THUMB_H   = Math.round(HOME_THUMB_W * (4 / 3));

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 17) return '안녕하세요';
  return '좋은 저녁이에요';
}

// --- Screen

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const nav = useNavigation<any>();
  const [sessions,         setSessions]          = useState<WorkoutLog[]>([]);
  const [splitConfig,      setSplitConfig]       = useState<UserSplitConfig | null>(null);
  const [ounwanPosts,        setOunwanPosts]         = useState<WorkoutFeedPost[]>([]);
  const [weekTargetMap,      setWeekTargetMap]       = useState<Record<string, string | null>>({});

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
            // 2026-11-04: 머신 부위가 "Chest, Shoulder"처럼 묶여 있으면 오운완 부위와 비교되지 않아 낱개로 풀어서 쓴다
            const todayMuscles = (todayLogs[0].targetMuscles && todayLogs[0].targetMuscles.length > 0)
              ? todayLogs[0].targetMuscles
              : [...new Set(todayLogs[0].machines.flatMap(m => parseMuscles(m.targetMuscle)))];
            feedMuscleFilter = todayMuscles;
            hasFeedMuscleFilter = todayMuscles.length > 0;

            // 오늘 운동을 마쳤으면 다음 차례는 내일부터 배정 (연속 기록 카드와 일치)
            const weekDates = getThisWeekDates();
            setWeekTargetMap(getWeekTargetMap(config, weekDates, true));
          } else {
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
          if (widened.length > posts.length) posts = widened;
        }

        if (hasFeedMuscleFilter) {
          const filtered = posts.filter(p => p.muscles.some(m => feedMuscleFilter.includes(m)));
          if (filtered.length > 0) {
            setOunwanPosts(filtered);
          } else {
            // 2026-11-04: 오늘 부위의 오운완이 없으면 전체를 보여준다
            setOunwanPosts(posts);
          }
        } else {
          setOunwanPosts(posts);
        }
      }
      perfStart('HomeScreen:load');
      load().finally(() => perfEnd('HomeScreen:load'));
      return () => { active = false; };
    }, [user?.id])
  );

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

  const handleFeedPress = useCallback(() => nav.navigate('WorkoutFeed'), [nav]);
  // "더보기" 버튼 전용 — 개별 오운완 게시물 탭(handleFeedPress)과는 별도로,
  // "더보기" 버튼 탭 횟수만 집계하기 위해 분리함.
  const handleFeedMorePress = useCallback(() => { track('ounwan_more'); nav.navigate('WorkoutFeed'); }, [nav]);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>

        {/* ── Header (2026-11-23: 인사말 한 줄, 닉네임·프로필 사진 삭제) ── */}
        {/* 2026-11-24: 비로그인은 '[로고]에 오신 걸 환영해요.' + 안내 한 줄 */}
        <View style={st.header}>
          {user ? (
            <Text style={st.greet} numberOfLines={1}>{greeting()}</Text>
          ) : (
            <>
              <View style={st.welcomeRow}>
                <GymPickLogo color={C.text} height={14} />
                <Text style={st.greet} numberOfLines={1}>에 오신 걸 환영해요.</Text>
              </View>
              <Text style={st.welcomeSub}>헬스장과 머신을 탐색해보세요.</Text>
            </>
          )}
        </View>

        {/* ── 연속 운동 기록 (2026-11-21: 루틴 반영 + 체크 줄) ── */}
        {user && (
          <StreakSection
            sessions={sessions}
            splitConfig={splitConfig}
            onPress={() => nav.navigate('Journal')}
          />
        )}

        {/* 2026-11-24: '지난 운동' 한 줄은 운동일지 작성 첫 화면(헬스장 선택)으로 이동 */}

        {/* ── 이번 주 운동일지 (retro thumbnail row) ── */}
        {user && (
          <>
            {/* 2026-11-23: '이번 주 운동 · 더보기' 제목 줄 삭제 (미니멀) */}
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
                const photoSources = getOunwanImageSources(
                  { original: session?.compositeUri ?? session?.photoUri, thumbnail: session?.thumbnailUri },
                  'grid',
                );
                const photoSrc = photoSources.length > 0;
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
                        <FallbackImage
                          sources={photoSources}
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

        {/* 2026-11-04: 'Find a Gym & Start' 버튼 삭제 (하단 탭 '기록하기'와 같은 기능) */}

        {/* ── 오늘의 오운완 피드 ── */}
        {/* 2026-11-23: 제목 줄('최근 ○○ 운동한 사람들이에요 · 더보기') 삭제, 더보기는 그리드 아래로 */}
        {/* 2026-11-24: 비로그인만 제목 '최근 운동한 사람들이에요!💪' */}
        <OunwanGrid
          posts={ounwanPosts}
          title={user ? undefined : '최근 운동한 사람들이에요!💪'}
          onPressPost={handleFeedPress}
          onMorePress={handleFeedMorePress}
        />

        <View style={{ height: 32 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

// --- Styles

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },

  // Guest header

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
    paddingHorizontal: screenPad,
    paddingTop:        16,
    paddingBottom:     12,
  },
  greet: { fontSize: 17, color: C.text, fontWeight: '800', letterSpacing: -0.3 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  welcomeSub: { fontSize: 13, color: C.textSub, fontWeight: '500', marginTop: 6 },


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
    borderRadius:    6,
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
});
