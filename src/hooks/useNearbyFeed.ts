import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import { WorkoutFeedPost } from '../data/types';
import { fetchGyms } from '../lib/db/gyms';
import { fetchOunwanPostsByGymIds } from '../lib/db/feedPosts';
import { calcDistanceKm } from '../lib/geocoding';

// 2026-10-19 (F2-4): 오운완 피드 '주변 5km' 탭 데이터.
// 게시물 위치 = 그 게시물 헬스장의 좌표, 내 위치 = 탭을 볼 때의 기기 현재 위치
// (서버에 저장하지 않음). 반경 5km 고정, 기간 제한 없음, 공개 + 헬스장 노출 글만.
// 위치 권한은 탭을 연다고 자동으로 요청하지 않고, 버튼(requestPermission)으로만 요청한다.

export type NearbyPermission = 'checking' | 'granted' | 'denied';

const PAGE_SIZE = 30;
const RADIUS_KM = 5;

export function useNearbyFeed(enabled: boolean, myUserId?: string | null): {
  permission: NearbyPermission;
  canAskAgain: boolean;
  posts: WorkoutFeedPost[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  requestPermission: () => Promise<void>;
  reload: () => void;
} {
  const [permission,  setPermission]  = useState<NearbyPermission>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [posts,       setPosts]       = useState<WorkoutFeedPost[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [hasMore,     setHasMore]     = useState(false);

  // 요청 번호 — 새 로딩이 시작됐거나 언마운트된 뒤 늦게 도착한 응답은 버린다
  const requestIdRef   = useRef(0);
  const loadingMoreRef = useRef(false);
  const gymIdsRef      = useRef<string[]>([]);
  const permissionRef  = useRef<NearbyPermission>('checking');
  // 권한 요청 대화상자도 앱을 inactive → active로 만들기 때문에, 요청 중에는 AppState 재확인을 건너뛴다
  const requestingRef  = useRef(false);
  permissionRef.current = permission;

  const markMine = useCallback(
    (list: WorkoutFeedPost[]) =>
      myUserId ? list.map(p => (p.userId === myUserId ? { ...p, isMyPost: true } : p)) : list,
    [myUserId],
  );

  // 권한이 있을 때: 현재 위치 → 5km 안 헬스장 → 그 헬스장들의 오운완 첫 페이지
  const loadPosts = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    loadingMoreRef.current = false;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (requestId !== requestIdRef.current) return;
      const { latitude, longitude } = pos.coords;

      const gyms = await fetchGyms();
      if (requestId !== requestIdRef.current) return;
      const gymIds = gyms
        .filter(g =>
          g.latitude != null && g.longitude != null &&
          calcDistanceKm(latitude, longitude, g.latitude, g.longitude) <= RADIUS_KM
        )
        .map(g => g.id);
      gymIdsRef.current = gymIds;

      if (gymIds.length === 0) {
        setPosts([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const result = await fetchOunwanPostsByGymIds(gymIds, { limit: PAGE_SIZE });
      if (requestId !== requestIdRef.current) return;
      setPosts(markMine(result));
      setHasMore(result.length === PAGE_SIZE);
      setLoading(false);
    } catch (e) {
      // 위치 조회 실패 등 → 권한은 그대로 두고 "데이터 없음"으로 처리
      if (__DEV__) console.warn('[useNearbyFeed] load error:', e);
      if (requestId !== requestIdRef.current) return;
      gymIdsRef.current = [];
      setPosts([]);
      setHasMore(false);
      setLoading(false);
    }
  }, [markMine]);

  // 권한 상태 확인 (요청은 하지 않음) → 허용이면 로딩
  const checkAndLoad = useCallback(async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      setCanAskAgain(perm.canAskAgain);
      if (perm.status === 'granted') {
        setPermission('granted');
        await loadPosts();
      } else {
        requestIdRef.current++;
        setPermission('denied');
        setPosts([]);
        setHasMore(false);
        setLoading(false);
      }
    } catch (e) {
      if (__DEV__) console.warn('[useNearbyFeed] permission check error:', e);
      setPermission('denied');
      setLoading(false);
    }
  }, [loadPosts]);

  useEffect(() => {
    if (!enabled) return;
    checkAndLoad();
  }, [enabled, checkAndLoad]);

  // 설정 앱에서 권한을 바꾸고 돌아온 경우: 포그라운드 복귀 시 다시 확인
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' || requestingRef.current) return;
      Location.getForegroundPermissionsAsync().then(perm => {
        setCanAskAgain(perm.canAskAgain);
        if (perm.status === 'granted' && permissionRef.current !== 'granted') {
          setPermission('granted');
          setLoading(true);
          loadPosts();
        } else if (perm.status !== 'granted' && permissionRef.current === 'granted') {
          requestIdRef.current++;
          setPermission('denied');
          setPosts([]);
          setHasMore(false);
        }
      }).catch(() => {});
    });
    return () => sub.remove();
  }, [enabled, loadPosts]);

  useEffect(() => () => { requestIdRef.current++; }, []);

  const requestPermission = useCallback(async () => {
    if (!canAskAgain) {
      Linking.openSettings();
      return;
    }
    requestingRef.current = true;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      setCanAskAgain(perm.canAskAgain);
      if (perm.status === 'granted') {
        setPermission('granted');
        setLoading(true);
        await loadPosts();
      } else {
        setPermission('denied');
      }
    } catch (e) {
      if (__DEV__) console.warn('[useNearbyFeed] permission request error:', e);
    } finally {
      requestingRef.current = false;
    }
  }, [canAskAgain, loadPosts]);

  const loadMore = useCallback(async () => {
    const gymIds = gymIdsRef.current;
    if (!hasMore || loadingMoreRef.current || gymIds.length === 0 || posts.length === 0) return;
    loadingMoreRef.current = true;
    const requestId = requestIdRef.current;
    const last = posts[posts.length - 1];
    const result = await fetchOunwanPostsByGymIds(gymIds, { limit: PAGE_SIZE, before: last.createdAt });
    if (requestId !== requestIdRef.current) return;
    setPosts(prev => {
      const seen = new Set(prev.map(p => p.id));
      return [...prev, ...markMine(result).filter(p => !seen.has(p.id))];
    });
    setHasMore(result.length === PAGE_SIZE);
    loadingMoreRef.current = false;
  }, [hasMore, posts, markMine]);

  const reload = useCallback(() => {
    if (permissionRef.current === 'granted') loadPosts();
  }, [loadPosts]);

  return { permission, canAskAgain, posts, loading, hasMore, loadMore, requestPermission, reload };
}
