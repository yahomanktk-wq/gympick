import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, R, T } from '../theme';
import { btnHeight, cardPadH, cardPadV, iconSize, screenPad } from '../theme/responsive';
import GymDetailModal from './flow/GymDetailModal';
import { useAuth } from '../context/AuthContext';

import { WorkoutLog, WorkoutFeedPost } from '../data/types';
import { fetchWorkoutLogs } from '../lib/db';
import { MOCK_FEED_POSTS } from '../data/workoutFeed';
import { filterActivePosts, convertSessionToFeedPost } from '../lib/feedUtils';

// --- Helpers

function getThisWeekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const { width: SCREEN_W } = Dimensions.get('window');
const HOME_THUMB_W  = Math.floor((SCREEN_W - 32) / 3.5);
const HOME_THUMB_H  = Math.round(HOME_THUMB_W * (4 / 3));
const FEED_MINI_W   = Math.floor(SCREEN_W * 0.65);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 17) return '안녕하세요';
  return '좋은 저녁이에요';
}

// ── Feed mini card (module-level to support per-card imgRatio state) ─────────

function FeedMiniCard({ post, onPress }: { post: WorkoutFeedPost; onPress: () => void }) {
  const [imgRatio, setImgRatio] = useState(3 / 4);
  const displayUri = post.compositeUri ?? post.photoUri;
  return (
    <TouchableOpacity
      style={[st.feedMiniCard, { width: FEED_MINI_W }]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <ExpoImage
        source={{ uri: displayUri }}
        style={[st.feedMiniPhoto, { height: Math.round(FEED_MINI_W * imgRatio) }]}
        contentFit="cover"
        onLoad={(e) => {
          const { width, height } = e.source;
          if (width && height) setImgRatio(height / width);
        }}
      />
      <View style={st.feedMiniOverlay}>
        <Text style={st.feedMiniNickname} numberOfLines={1}>{post.nickname}</Text>
        <Text style={st.feedMiniReaction}>💪 {post.reactions.muscle}</Text>
      </View>
    </TouchableOpacity>
  );
}

function computeStreak(logs: WorkoutLog[]): number {
  if (!logs.length) return 0;
  const uniqueDates = [...new Set(logs.map(l => l.date.slice(0, 10)))].sort().reverse();
  if (!uniqueDates.length) return 0;
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    prev.setDate(prev.getDate() - 1);
    if (uniqueDates[i] === prev.toISOString().slice(0, 10)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// --- Screen

export default function HomeScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [gymDetailVisible, setGymDetailVisible] = useState(false);
  const [gymDetailId,      setGymDetailId]      = useState<string | null>(null);
  const [sessions,         setSessions]          = useState<WorkoutLog[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchWorkoutLogs(user.id)
        .then(logs => setSessions(logs))
        .catch(() => setSessions([]));
    }, [user?.id])
  );

  const streak       = useMemo(() => computeStreak(sessions), [sessions]);
  const activePosts  = useMemo(() => {
    const mockPosts = filterActivePosts(MOCK_FEED_POSTS);
    const myPosts = sessions
      .map(session => convertSessionToFeedPost(
        session,
        user?.id ?? 'guest',
        user?.nickname ?? user?.name ?? 'me',
        'g01',
      ))
      .filter((p): p is WorkoutFeedPost => p !== null);
    const combined = [...myPosts, ...mockPosts];
    const unique = combined.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
    const sorted = unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 유저별로 오늘 날짜 기준 가장 최신 포스트 1개만 남기기
    const today = new Date().toDateString();
    const seenUsers = new Set<string>();
    return sorted.filter(p => {
      const postDate = new Date(p.createdAt).toDateString();
      if (postDate !== today) return true; // 오늘이 아닌 건 그대로
      if (seenUsers.has(p.userId)) return false; // 같은 유저의 오늘 포스트는 첫 번째만
      seenUsers.add(p.userId);
      return true;
    });
  }, [sessions, user]);

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

  const lastSession = useMemo(() => {
    if (!sessions.length) return null;
    return [...sessions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
  }, [sessions]);

  const lastGymName = lastSession?.gymName ?? '';

  const lastDateStr = useMemo(() => {
    if (!lastSession) return '';
    const d = new Date(lastSession.date);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} · ${h12}:${mm} ${ampm}`;
  }, [lastSession]);

  const lastMuscles = useMemo(() => {
    if (!lastSession?.machines?.length) return [];
    return Array.from(
      new Set(lastSession.machines.map(m => m.targetMuscle).filter(Boolean))
    );
  }, [lastSession]);

  const lastExerciseCount = lastSession?.machines?.length ?? 0;

  const lastSetCount = useMemo(() => {
    if (!lastSession?.machines?.length) return 0;
    return lastSession.machines.reduce((sum, m) => sum + m.sets, 0);
  }, [lastSession]);

  const lastVolume = useMemo(() => {
    if (!lastSession?.machines?.length) return '0';
    const total = lastSession.machines.reduce((sum, m) => {
      return sum + m.weight * m.reps * m.sets;
    }, 0);
    if (total >= 1000) return `${(total / 1000).toFixed(1)}t`;
    return `${total}`;
  }, [lastSession]);

  const lastMachineRows = useMemo(() => {
    if (!lastSession?.machines?.length) return [];
    return lastSession.machines.slice(0, 5).map(m => ({
      name:   m.machineName,
      weight: m.weight,
      reps:   m.reps,
      sets:   m.sets,
      muscle: m.targetMuscle,
    }));
  }, [lastSession]);

  function openNearby()          { nav.navigate('FindGym', { initialTab: 'gym', viewMode: 'map' }); }
  function openGym(id: string)   { setGymDetailId(id); setGymDetailVisible(true); }

  return (
    <SafeAreaView style={st.safe}>
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
              <TouchableOpacity onPress={() => nav.navigate('Journal')}>
                <Text style={st.seeAll}>더보기</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.weekThumbScroll}
            >
              {thisWeekDays.map((day, i) => {
                const session = thisWeekSessions.find(s => isSameDay(new Date(s.date), day));
                const today   = new Date();
                const isToday = isSameDay(day, today);
                const isPast  = day <= today;
                const photoSrc = session?.compositeUri ?? session?.photoUri;
                const mm = String(day.getMonth() + 1).padStart(2, '0');
                const dd = String(day.getDate()).padStart(2, '0');
                return (
                  <TouchableOpacity
                    key={i}
                    style={[st.weekThumbCell, !isPast && { opacity: 0.3 }]}
                    activeOpacity={session ? 0.75 : 1}
                    onPress={() => {
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
                    <View style={[st.weekThumbBox, !photoSrc && st.weekThumbBoxEmpty, isToday && !photoSrc && st.weekThumbBoxToday]}>
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
                          {isPast && <Ionicons name="add" size={16} color={C.border} />}
                        </View>
                      )}
                    </View>
                    <Text style={[st.weekThumbDate, isToday && { color: C.accent }]}>
                      {`${mm}.${dd}`}
                    </Text>
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
            onPress={() => nav.navigate('Profile')}
          >
            <Ionicons name="person-outline" size={15} color={C.accent} />
            <Text style={st.guestBannerText}>
              로그인하고 운동을 기록해보세요.
            </Text>
            <Ionicons name="chevron-forward" size={14} color={C.accent} />
          </TouchableOpacity>
        )}

        {/* ── Last Session Summary ── */}
        {user && lastSession && (
          <TouchableOpacity
            style={st.recentCard}
            activeOpacity={0.88}
            onPress={() => nav.navigate('Journal')}
          >
            <Text style={st.recentEye}>마지막 운동</Text>
            <Text style={st.recentMuscleTitle} numberOfLines={1}>
              {lastMuscles.length > 0 ? lastMuscles.join(' + ') : '운동 기록 없음'}
            </Text>
            <Text style={st.recentGymSub} numberOfLines={1}>{lastGymName}</Text>
            <Text style={st.recentDate}>{lastDateStr}</Text>

            {/* Stats */}
            <View style={st.recentStats}>
              <View style={st.recentStat}>
                <Text style={st.recentStatVal}>{lastExerciseCount}</Text>
                <Text style={st.recentStatLab}>운동</Text>
              </View>
              <View style={st.recentDiv} />
              <View style={st.recentStat}>
                <Text style={st.recentStatVal}>{lastSetCount}</Text>
                <Text style={st.recentStatLab}>세트</Text>
              </View>
              <View style={st.recentDiv} />
              <View style={st.recentStat}>
                <Text style={st.recentStatVal}>{lastVolume}</Text>
                <Text style={st.recentStatLab}>볼륨</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        {!user && (
          <TouchableOpacity
            style={st.recentCard}
            activeOpacity={0.88}
            onPress={() => nav.navigate('Profile')}
          >
            <Text style={st.recentEye}>운동 기록</Text>
            <Text style={st.recentGymSub}>운동 기록이 여기에 표시됩니다.</Text>
            <Text style={st.recentDate}>로그인하고 운동을 기록해보세요.</Text>
          </TouchableOpacity>
        )}

        {/* ── Find Gym CTA ── */}
        <TouchableOpacity
          style={st.ctaCard}
          activeOpacity={0.88}
          onPress={user ? openNearby : () => nav.navigate('LogWorkout')}
        >
          <View style={st.ctaLeft}>
            <Text style={st.ctaEye}>READY TO LIFT?</Text>
            <Text style={st.ctaTitle}>Find a Gym{'\n'}& Start</Text>
          </View>
          <View style={st.ctaBtn}>
            <Ionicons name="play" size={24} color={C.bg} />
          </View>
        </TouchableOpacity>

        {/* ── Nearby Gyms ── */}
        <View style={st.sectionRow}>
          <Text style={st.sectionTitle}>주변 헬스장</Text>
        </View>
        <TouchableOpacity
          style={st.nearbyMapBtn}
          activeOpacity={0.85}
          onPress={() => nav.navigate('FindGym', { initialTab: 'gym', viewMode: 'map' })}
        >
          <View style={st.nearbyMapBtnLeft}>
            <Ionicons name="map-outline" size={22} color={C.accent} />
            <View>
              <Text style={st.nearbyMapBtnTitle}>내 주변 헬스장 보기</Text>
              <Text style={st.nearbyMapBtnSub}>지도에서 가까운 헬스장을 확인하세요</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textDim} />
        </TouchableOpacity>

        {/* ── 오늘의 오운완 피드 ── */}
        <View style={st.sectionRow}>
          <Text style={st.sectionTitle}>오늘의 오운완 🔥</Text>
          <TouchableOpacity onPress={() => nav.navigate('WorkoutFeed')}>
            <Text style={st.seeAll}>더보기</Text>
          </TouchableOpacity>
        </View>
        {activePosts.length === 0 ? (
          <View style={st.feedEmpty}>
            <Text style={st.feedEmptyText}>아직 오늘의 오운완이 없어요</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.feedScroll}
          >
            {activePosts.slice(0, 4).map(post => (
              <FeedMiniCard
                key={post.id}
                post={post}
                onPress={() => nav.navigate('WorkoutFeed')}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Last Session ── */}
        {user && lastSession && <View style={st.sectionRow}>
          <Text style={st.sectionTitle}>마지막 운동</Text>
          <TouchableOpacity onPress={() => nav.navigate('Journal')}>
            <Text style={st.seeAll}>기록 보기</Text>
          </TouchableOpacity>
        </View>}
        {user && lastSession && <View style={st.sessionCard}>
          {/* Session header */}
          <View style={st.sessionHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.sessionGym}>{lastGymName}</Text>
              <Text style={st.sessionDate}>{lastDateStr}</Text>
            </View>
          </View>

          <View style={st.divider} />

          {/* Exercise rows */}
          {lastMachineRows.map((m, i) => (
            <React.Fragment key={`${m.name}-${i}`}>
              <View style={st.exRow}>
                <Text style={st.exName} numberOfLines={1}>{m.name}</Text>
                <Text style={st.exMeta}>{m.sets}×{m.reps} · {m.weight} kg</Text>
              </View>
              {i < lastMachineRows.length - 1 && <View style={st.exDivider} />}
            </React.Fragment>
          ))}

          {/* Navigate to journal */}
          <TouchableOpacity
            style={st.viewLogBtn}
            onPress={() => nav.navigate('Journal')}
            activeOpacity={0.8}
          >
            <Text style={st.viewLogTxt}>전체 기록 보기</Text>
            <Ionicons name="chevron-forward" size={13} color={C.accent} />
          </TouchableOpacity>
        </View>}

        <View style={{ height: 32 }} />
      </ScrollView>

      <GymDetailModal
        visible={gymDetailVisible}
        gymId={gymDetailId}
        onClose={() => setGymDetailVisible(false)}
      />
    </SafeAreaView>
  );
}

// --- Styles

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },

  // Feed mini
  feedScroll:      { paddingHorizontal: screenPad, gap: 10, paddingBottom: 4 },
  feedMiniCard:    { borderRadius: R.inner, overflow: 'hidden', backgroundColor: C.surface },
  feedMiniPhoto:   { width: '100%' },
  feedMiniOverlay: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7,
  },
  feedMiniNickname: { fontSize: 12, fontWeight: '700', color: C.text, flex: 1 },
  feedMiniReaction: { fontSize: 12, fontWeight: '600', color: C.accent },
  feedEmpty: {
    marginHorizontal: screenPad, marginBottom: 16,
    backgroundColor: C.surface, borderRadius: R.inner,
    paddingVertical: 20, alignItems: 'center',
  },
  feedEmptyText: { fontSize: 13, color: C.textDim },

  // Streak banner
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: screenPad, marginBottom: 12,
    backgroundColor: C.accentBg, borderRadius: R.inner,
    paddingHorizontal: cardPadH, paddingVertical: 10,
  },
  streakEmoji:  { fontSize: 18 },
  streakText:   { fontSize: 15, fontWeight: '800', color: C.accent },
  streakSub:    { fontSize: 12, color: C.accent, opacity: 0.7, marginLeft: 2 },
  streakEmpty:  { flex: 1, fontSize: 13, color: C.textDim, lineHeight: 18 },

  // Guest header
  guestHeaderSub: { fontSize: 13, color: C.textSub, fontWeight: '500', marginTop: 4 },
  guestAvatar:    { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },

  // Guest placeholder
  guestPlaceholderCard: {
    marginHorizontal: screenPad,
    marginBottom: 24,
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: cardPadH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  guestPlaceholderText: { flex: 1, fontSize: 14, color: C.textSub, lineHeight: 20 },

  // Guest banner
  guestBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              8,
    marginHorizontal: screenPad,
    marginBottom:     16,
    backgroundColor:  C.accentBg,
    borderRadius:     R.inner,
    paddingHorizontal: cardPadH,
    paddingVertical:  11,
  },
  guestBannerText: { flex: 1, fontSize: 13, color: C.accent, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: screenPad, paddingTop: 24, paddingBottom: 16,
  },
  greet:     { fontSize: 14, color: C.textSub, fontWeight: '500' },
  name:      { fontSize: 30, fontWeight: '900', color: C.text, letterSpacing: -1 },
  avatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },

  // Last session summary card
  recentCard: {
    marginHorizontal: screenPad, marginTop: 8, marginBottom: 24,
    backgroundColor: C.surface, borderRadius: R.card,
    padding: cardPadH,
  },
  recentEye:         { fontSize: 9, fontWeight: '900', color: C.accent, letterSpacing: 1.5, marginBottom: 8 },
  recentMuscleTitle: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 2 },
  recentGymSub:      { fontSize: 13, color: C.textSub, fontWeight: '600', marginBottom: 2 },
  recentDate:        { fontSize: 12, color: C.textDim, marginBottom: 14 },
  recentStats:      { flexDirection: 'row', alignItems: 'center' },
  recentStat:       { flex: 1, alignItems: 'center' },
  recentStatVal:    { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  recentStatLab:    { fontSize: 11, color: C.textSub, fontWeight: '600', marginTop: 2 },
  recentDiv:        { width: 1, height: 32, backgroundColor: C.border },

  // Section headers
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: screenPad, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  sectionHint:  { fontSize: 12, color: C.textDim },
  seeAll:       { fontSize: 13, fontWeight: '700', color: C.accent },

  // Weekly retro thumbnail row
  weekThumbScroll: {
    paddingHorizontal: screenPad,
    gap: 8,
    paddingBottom: 24,
  },
  weekThumbCell: {
    width: HOME_THUMB_W,
    alignItems: 'center',
    gap: 5,
  },
  weekThumbDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textDim,
    letterSpacing: 0.3,
  },
  weekThumbBox: {
    width: HOME_THUMB_W,
    height: HOME_THUMB_H,
    borderRadius: 10,
    backgroundColor: C.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  weekThumbImg: { width: '100%', height: '100%' },
  weekThumbEmptyInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  weekThumbDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  weekThumbDate: { fontSize: 9, fontWeight: '600', color: C.textSub },

  // CTA
  ctaCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.card,
    marginHorizontal: screenPad, marginBottom: 24,
    padding: cardPadH, gap: 16,
  },
  ctaLeft:  { flex: 1 },
  ctaEye:   { fontSize: 9, fontWeight: '900', color: C.accent, letterSpacing: 1.5, marginBottom: 6 },
  ctaTitle: { fontSize: 24, fontWeight: '900', color: C.text, lineHeight: 26, letterSpacing: -0.8 },
  ctaBtn:   { width: btnHeight, height: btnHeight, borderRadius: btnHeight / 2, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },

  // Nearby gyms
  gymScroll: { paddingHorizontal: screenPad, gap: 10, paddingBottom: 4, marginBottom: 24 },
  gymChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: R.card,
    padding: 14, width: 210,
  },
  gymName: { fontSize: 14, fontWeight: '700', color: C.text },
  gymSub:  { fontSize: 12, color: C.textSub, marginTop: 2 },

  // Nearby map button
  nearbyMapBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   C.surface,
    borderRadius:      R.card,
    borderWidth:       1,
    borderColor:       C.border,
    padding:           16,
    marginBottom:      24,
    marginHorizontal:  screenPad,
  },
  nearbyMapBtnLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    flex:          1,
  },
  nearbyMapBtnTitle: {
    fontSize:     15,
    fontWeight:   '700',
    color:        C.text,
    marginBottom: 2,
  },
  nearbyMapBtnSub: {
    fontSize: 12,
    color:    C.textSub,
  },

  // Last Session card
  sessionCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    marginHorizontal: screenPad, overflow: 'hidden',
  },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: cardPadH },
  sessionGym:  { fontSize: 14, fontWeight: '800', color: C.text },
  sessionDate: { fontSize: 11, color: C.textSub, marginTop: 2 },
  divider:     { height: 1, backgroundColor: C.border },

  exRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  exName:    { flex: 1, fontSize: 13, fontWeight: '600', color: C.text },
  exMeta:    { fontSize: 12, color: C.textSub, fontWeight: '600' },
  exDivider: { height: 1, backgroundColor: C.border, marginLeft: 16 },

  viewLogBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 14,
  },
  viewLogTxt: { fontSize: 13, fontWeight: '700', color: C.accent },
});
