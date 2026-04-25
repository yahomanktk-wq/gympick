import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { WorkoutFeedPost, WorkoutLog } from '../data/types';
// MOCK_FEED_POSTS는 인라인으로 대체 (빌드 이슈 방지)
const MOCK_FEED_POSTS: WorkoutFeedPost[] = [];
import { filterActivePosts, filterByGym, filterByDistance, toggleReaction, convertSessionToFeedPost } from '../lib/feedUtils';
import { fetchActiveFeedPosts } from '../lib/db/feedPosts';
import { getNewSessions } from '../data/sessionStore';
import WorkoutFeedCard from '../components/WorkoutFeedCard';
import { useAuth } from '../context/AuthContext';

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
    tab === '내 헬스장' ? '같은 헬스장 회원의 오운완이 없어요' :
    tab === '주변 5km'  ? '주변 5km 내 오운완이 없어요' :
                          '오늘 등록된 오운완이 없어요';
  return (
    <View style={s.empty}>
      <Ionicons name="image-outline" size={44} color={C.textDim} />
      <Text style={s.emptyText}>{msg}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WorkoutFeedScreen() {
  const nav      = useNavigation<any>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FeedTab>('전국');
  const [posts, setPosts]         = useState<WorkoutFeedPost[]>([]);

  const MY_GYM_ID = user?.gymId ?? 'g01';

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadPosts() {
        // 1. 내 세션 → 피드 포스트로 변환
        const mySessions: WorkoutLog[] = getNewSessions(user?.id ?? 'guest');
        const myPosts = mySessions
          .map(session => convertSessionToFeedPost(
            session,
            user?.id  ?? 'guest',
            user?.nickname ?? user?.name ?? 'me',
            MY_GYM_ID,
          ))
          .filter((p): p is WorkoutFeedPost => p !== null);

        // 2. Supabase 피드 조회 (실패 시 Mock fallback)
        const [serverPosts] = await Promise.all([fetchActiveFeedPosts()]);
        const myUserId = user?.id ?? 'guest';

        // 서버 포스트에서 내 포스트 제외 (로컬 myPosts와 중복 방지)
        const otherPosts = (serverPosts.length === 0
          ? filterActivePosts(MOCK_FEED_POSTS)
          : serverPosts
        ).filter(p => p.userId !== myUserId);

        // 3. 합산 + 중복 제거 + 최신순
        const combined = [...myPosts, ...otherPosts];
        const unique   = combined.filter((p, i, arr) =>
          arr.findIndex(x => x.id === p.id) === i
        );
        if (active) setPosts(sortByLatest(unique));
      }

      loadPosts();
      return () => { active = false; };
    }, [user, MY_GYM_ID])
  );

  const filtered = useMemo(() => {
    if (activeTab === '내 헬스장') {
      return filterWithMyPosts(posts, filterByGym(posts, MY_GYM_ID));
    }
    if (activeTab === '주변 5km') {
      return filterWithMyPosts(posts, filterByDistance(posts, 5));
    }
    return sortByLatest(posts);
  }, [posts, activeTab, MY_GYM_ID]);

  const handleReact = useCallback((postId: string, key: keyof WorkoutFeedPost['reactions']) => {
    setPosts(prev => prev.map(p => p.id === postId ? toggleReaction(p, key) : p));
  }, []);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<WorkoutFeedPost>) => (
    <View style={s.cardWrap}>
      <WorkoutFeedCard post={item} onReact={handleReact} />
    </View>
  ), [handleReact]);

  const keyExtractor = useCallback((item: WorkoutFeedPost) => item.id, []);

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

      {filtered.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
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
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: C.surface, borderRadius: R.inner, padding: 3,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: R.inner - 2,
  },
  tabBtnActive:   { backgroundColor: C.bg },
  tabLabel:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  tabLabelActive: { color: C.text, fontWeight: '800' },
  list:           { paddingHorizontal: 16, paddingBottom: 32 },
  cardWrap:       {},
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingBottom: 60,
  },
  emptyText: { fontSize: 14, color: C.textDim, fontWeight: '500' },
});
