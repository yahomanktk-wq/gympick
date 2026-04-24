import { WorkoutFeedPost, WorkoutLog } from '../data/types';

/** 24시간 이내 게시물만 필터링 */
export function filterActivePosts(posts: WorkoutFeedPost[]): WorkoutFeedPost[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return posts.filter(p => new Date(p.createdAt).getTime() >= cutoff);
}

/** 내 헬스장 탭 필터 (gymId 기준) */
export function filterByGym(posts: WorkoutFeedPost[], gymId: string): WorkoutFeedPost[] {
  return posts.filter(p => p.gymId === gymId);
}

/** 주변 탭 필터 (distanceKm <= maxKm) */
export function filterByDistance(posts: WorkoutFeedPost[], maxKm: number): WorkoutFeedPost[] {
  return posts.filter(p => p.distanceKm !== undefined && p.distanceKm <= maxKm);
}

/** 내 세션을 피드 포스트로 변환 (compositeUri/photoUri 없으면 null, 24h 초과 시 null) */
export function convertSessionToFeedPost(
  session: WorkoutLog,
  userId: string,
  nickname: string,
  fallbackGymId: string,
): WorkoutFeedPost | null {
  const photoUri = session.compositeUri ?? session.photoUri;
  if (!photoUri) return null;

  const diffMs = Date.now() - new Date(session.date).getTime();
  if (diffMs > 24 * 60 * 60 * 1000) return null;

  return {
    id:           `my-${session.id}`,
    userId,
    nickname,
    gymId:        session.gymId ?? fallbackGymId,
    gymName:      session.gymName ?? '',
    photoUri,
    compositeUri: session.compositeUri,
    muscles:      session.machines?.map(m => m.targetMuscle) ?? [],
    createdAt:    session.date,
    isPublic:     true,
    isMyPost:     true,
    reactions:    { muscle: 0, fire: 0, clap: 0, trophy: 0, flex: 0 },
    myReaction:   null,
  };
}

/** 리액션 토글 — 같은 키 누르면 취소, 다른 키 누르면 교체 */
export function toggleReaction(
  post: WorkoutFeedPost,
  key: keyof WorkoutFeedPost['reactions'],
): WorkoutFeedPost {
  const prev = post.myReaction;
  const reactions = { ...post.reactions };

  if (prev === key) {
    // 같은 키 → 취소
    reactions[key] = Math.max(0, reactions[key] - 1);
    return { ...post, reactions, myReaction: null };
  }

  // 이전 리액션 취소
  if (prev) {
    reactions[prev] = Math.max(0, reactions[prev] - 1);
  }

  // 새 리액션 추가
  reactions[key] = reactions[key] + 1;
  return { ...post, reactions, myReaction: key };
}
