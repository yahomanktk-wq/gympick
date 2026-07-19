// 오운완 피드 게시물 — 화면 간(홈/피드) 공유 캐시. TTL 60초 + in-flight 요청 공유.

import { WorkoutFeedPost } from './types';
import { fetchActiveFeedPosts } from '../lib/db/feedPosts';

const TTL_MS = 60 * 1000;

let _cachedPosts: WorkoutFeedPost[] = [];
let _lastFetchedAt = 0;
let _inFlight: Promise<WorkoutFeedPost[]> | null = null;

/**
 * TTL(60초) 이내면 네트워크 호출 없이 캐시된 배열을 그대로 반환한다.
 * TTL이 지났으면 fetchActiveFeedPosts()로 캐시를 갱신한다.
 * 같은 프레임에서 여러 곳이 동시에 호출해도 진행 중인 요청 하나만 공유한다.
 */
export function getActiveFeedPostsCached(): Promise<WorkoutFeedPost[]> {
  if (_inFlight) return _inFlight;

  if (Date.now() - _lastFetchedAt < TTL_MS) {
    return Promise.resolve(_cachedPosts);
  }

  _inFlight = fetchActiveFeedPosts()
    .then(posts => {
      _cachedPosts   = posts;
      _lastFetchedAt = Date.now();
      return posts;
    })
    .catch(() => [] as WorkoutFeedPost[])   // fetchActiveFeedPosts의 실패 시 빈 배열 반환 관례를 따름
    .finally(() => {
      _inFlight = null;
    });

  return _inFlight;
}

/** 새 오운완 업로드 직후 등, 다음 조회 때 최신 데이터를 강제로 받아야 할 때 캐시를 무효화한다. */
export function invalidateActiveFeedPostsCache(): void {
  _lastFetchedAt = 0;
  _cachedPosts   = [];
}
