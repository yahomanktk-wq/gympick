import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { WorkoutFeedPost, WorkoutLog } from '../data/types';
const MOCK_FEED_POSTS: WorkoutFeedPost[] = [];
import { filterActivePosts, filterByGym, filterByDistance, toggleReaction, convertSessionToFeedPost } from '../lib/feedUtils';
import { fetchActiveFeedPosts, fetchMyLatestGymId, fetchFeedPostsByGym } from '../lib/db/feedPosts';
import { fetchWorkoutLogs } from '../lib/db/workouts';
import { useAuth } from '../context/AuthContext';

// ── 상수 ─────────────────────────────────────────────────────────────────────

const SCREEN_W    = Dimensions.get('window').width;
const GRID_GAP    = 8;
const GRID_PAD    = 16;
const GRID_CARD_W = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP) / 2);

const MUSCLE_FILTERS = ['전체', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Glutes'] as const;
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

function EmptyState({ tab }: { tab: FeedTab }) {
  const msg =
    tab === '내 헬스장' ? '최근 방문한 헬스장의 오운완이 없어요' :
    tab === '주변 5km'  ? '주변 5km 내 오운완이 없어요' :
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
  const displayUri = post.compositeUri ?? post.photoUri;
  const CARD_H     = Math.round(width * 4 / 3);

  return (
    <TouchableOpacity
      style={{ width, borderRadius: R.card, overflow: 'hidden', backgroundColor: C.surface }}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: displayUri }}
        style={{ width, height: CARD_H }}
        contentFit="cover"
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
            return '곧 사라져요';
          })()}
        </Text>
      </View>
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: 8, paddingVertical: 6,
        flexDirection: 'row', gap: 4,
      }}>
        {post.muscles.slice(0, 2).map(m => (
          <View key={m} style={{
            backgroundColor: C.accent, borderRadius: R.pill,
            paddingHorizontal: 6, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 8, fontWeight: '800', color: '#000' }}>{m}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

// ── 이모지 리액션 상수 ────────────────────────────────────────────────────────

const EMOJI_MAP: Record<keyof WorkoutFeedPost['reactions'], string> = {
  muscle: '💪', fire: '🔥', clap: '👏', trophy: '🏆', flex: '😤',
};
const REACTION_KEYS: (keyof WorkoutFeedPost['reactions'])[] = [
  'muscle', 'fire', 'clap', 'trophy', 'flex',
];

// ── 상세 모달 ─────────────────────────────────────────────────────────────────

function FeedDetailModal({
  post,
  onClose,
  onReact,
}: {
  post:    WorkoutFeedPost;
  onClose: () => void;
  onReact: (postId: string, key: keyof WorkoutFeedPost['reactions']) => void;
}) {
  const displayUri = post.compositeUri ?? post.photoUri;
  const MODAL_W    = Dimensions.get('window').width;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* 헤더 */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
        }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>
              {post.nickname}
            </Text>
            <Text style={{ fontSize: 12, color: C.textSub }}>{post.gymName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* 인증샷 */}
          <Image
            source={{ uri: displayUri }}
            style={{ width: MODAL_W, aspectRatio: 3 / 4 }}
            contentFit="cover"
          />

          {/* 이모지 리액션 */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-around',
            paddingHorizontal: 8, paddingVertical: 16,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
          }}>
            {REACTION_KEYS.map(key => {
              const active = post.myReaction === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 8,
                    borderRadius: R.inner,
                    backgroundColor: active ? C.accentBg : 'transparent',
                  }}
                  onPress={() => !post.isMyPost && onReact(post.id, key)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 24 }}>{EMOJI_MAP[key]}</Text>
                  <Text style={{
                    fontSize: 12, fontWeight: '700', marginTop: 2,
                    color: active ? C.accent : C.textSub,
                  }}>
                    {post.reactions[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 루틴 카드 이미지 */}
          {post.routineCardUri ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={{
                fontSize: 12, fontWeight: '700', color: C.textDim,
                letterSpacing: 0.8, marginBottom: 10,
              }}>운동 루틴</Text>
              <Image
                source={{ uri: post.routineCardUri }}
                style={{ width: MODAL_W - 32, aspectRatio: 1, borderRadius: R.card }}
                contentFit="contain"
              />
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 0.8, marginBottom: 8 }}>
                운동 부위
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {post.muscles.map(m => (
                  <View key={m} style={{
                    backgroundColor: C.accentBg, borderRadius: R.pill,
                    paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  const [detailPost,   setDetailPost]   = useState<WorkoutFeedPost | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadPosts() {
        if (!user?.id) {
          if (active) setPosts([]);
          return;
        }
        const myUserId = user.id;
        const mySessions: WorkoutLog[] = await fetchWorkoutLogs(user.id).catch(() => []);

        // 24시간 이내 세션만 필터링
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recentSessions = mySessions.filter(
          s => new Date(s.date).getTime() >= cutoff
        );

        // 가장 최근 운동한 헬스장 ID fetch
        let latestGymId: string | null = null;
        latestGymId = await fetchMyLatestGymId(user.id);
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

        const myPosts = recentSessions
          .map(session => convertSessionToFeedPost(
            session,
            user.id,
            user?.nickname ?? user?.name ?? 'me',
            latestGymId ?? 'g01',
          ))
          .filter((p): p is WorkoutFeedPost => p !== null);

        const [serverPosts] = await Promise.all([fetchActiveFeedPosts()]);
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

    // 부위 필터
    if (muscleFilter === '전체') return base;
    return base.filter(p =>
      p.muscles.some(m => m.toLowerCase() === muscleFilter.toLowerCase())
    );
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
        <Text style={s.title}>오늘의 오운완</Text>
        <View style={{ width: 38 }} />
      </View>

      <TabSegment tabs={TABS} active={activeTab} onPress={setActiveTab} />

      {/* 타겟부위 필터칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 6 }}
      >
        {MUSCLE_FILTERS.map(m => {
          const active = muscleFilter === m;
          return (
            <TouchableOpacity
              key={m}
              style={{
                height: 30,
                paddingHorizontal: 14,
                borderRadius: R.pill,
                backgroundColor: active ? C.accentBg : C.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: active ? C.accent : C.border,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => setMuscleFilter(m)}
              activeOpacity={0.75}
            >
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: active ? C.accent : C.textSub,
              }}>
                {m}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: GRID_PAD }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 32, gap: GRID_GAP }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FeedGridCard
              post={item}
              width={GRID_CARD_W}
              onPress={() => setDetailPost(item)}
            />
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
        />
      )}
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
});
