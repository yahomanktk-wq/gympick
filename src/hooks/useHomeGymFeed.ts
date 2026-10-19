import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkoutFeedPost } from '../data/types';
import { HomeGym, resolveHomeGym } from '../lib/homeGym';
import { fetchGymOunwanPosts } from '../lib/db/feedPosts';

// 2026-10-19 (F2-2): 오운완 피드 '내 헬스장' 탭 데이터.
// 홈짐(resolveHomeGym: 수동 지정 → 30일 최빈) 기준으로, 헬스장 상세와 같은
// fetchGymOunwanPosts(공개 + show_on_gym, 기간 제한 없음, 최신순)를 쓴다.
// 탭이 활성화(enabled)됐을 때만 불러오고, reload()는 화면 포커스 시 호출된다.

const PAGE_SIZE = 30;

export function useHomeGymFeed(userId: string | null | undefined, enabled: boolean): {
  homeGym:  HomeGym | null;
  posts:    WorkoutFeedPost[];
  loading:  boolean;
  hasMore:  boolean;
  loadMore: () => void;
  reload:   () => void;
  /** 목록에서 글 하나 제거 (내 오운완을 비공개로 바꿨을 때) */
  removePost: (postId: string) => void;
} {
  const [homeGym, setHomeGym] = useState<HomeGym | null>(null);
  const [posts,   setPosts]   = useState<WorkoutFeedPost[]>([]);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [hasMore, setHasMore] = useState(false);

  // 요청마다 번호를 올려서, userId가 바뀌었거나 새 reload가 시작된 뒤 늦게
  // 도착한 응답은 버린다 (언마운트 시에도 번호를 올려 무효화).
  const requestIdRef   = useRef(0);
  const loadingMoreRef = useRef(false);
  const markMine = useCallback(
    (list: WorkoutFeedPost[]) => list.map(p => (p.userId === userId ? { ...p, isMyPost: true } : p)),
    [userId],
  );

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    loadingMoreRef.current = false;
    if (!userId) {
      setHomeGym(null);
      setPosts([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const gym = await resolveHomeGym(userId);
    if (requestId !== requestIdRef.current) return;
    if (!gym) {
      setHomeGym(null);
      setPosts([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const result = await fetchGymOunwanPosts(gym.gymId, { limit: PAGE_SIZE });
    if (requestId !== requestIdRef.current) return;
    setHomeGym(gym);
    setPosts(markMine(result));
    setHasMore(result.length === PAGE_SIZE);
    setLoading(false);
  }, [userId, markMine]);

  // userId가 바뀌면 첫 로딩 상태로 되돌린다
  useEffect(() => {
    setHomeGym(null);
    setPosts([]);
    setHasMore(false);
    setLoading(!!userId);
  }, [userId]);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  useEffect(() => () => { requestIdRef.current++; }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || !homeGym || posts.length === 0) return;
    loadingMoreRef.current = true;
    const requestId = requestIdRef.current;
    const last = posts[posts.length - 1];
    const result = await fetchGymOunwanPosts(homeGym.gymId, { limit: PAGE_SIZE, before: last.createdAt });
    if (requestId !== requestIdRef.current) return;
    setPosts(prev => {
      const seen = new Set(prev.map(p => p.id));
      return [...prev, ...markMine(result).filter(p => !seen.has(p.id))];
    });
    setHasMore(result.length === PAGE_SIZE);
    loadingMoreRef.current = false;
  }, [hasMore, homeGym, posts, markMine]);

  const reload = useCallback(() => { load(); }, [load]);

  const removePost = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  return { homeGym, posts, loading, hasMore, loadMore, reload, removePost };
}
