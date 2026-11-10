import { useCallback, useEffect, useState } from 'react';
import { fetchMyLikedPostIds, likeOunwan, unlikeOunwan } from '../../../lib/db/ounwanLikes';

// 2026-11-09: 오운완 하트 상태 공유 저장소 + 훅
// 같은 글이 피드·헬스장 그리드·상세에 동시에 떠 있어도 하트 상태가 맞도록 모듈 단위로 들고 있는다.
// '내가 눌렀는지'는 화면에 뜬 글 id를 잠깐 모았다가 한 번에 조회한다 (글마다 따로 조회하지 않음).

type Entry = { liked: boolean; count: number };

const entries = new Map<string, Entry>();          // postId → 내가 누름 여부 + 하트 수
const listeners = new Map<string, Set<() => void>>();
let ownerUserId: string | null = null;
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function emit(postId: string) {
  listeners.get(postId)?.forEach(fn => fn());
}

function setEntry(postId: string, next: Entry) {
  entries.set(postId, next);
  emit(postId);
}

function resetForUser(userId: string | null) {
  if (ownerUserId === userId) return;
  ownerUserId = userId;
  entries.clear();
  pending = new Set();
}

function queueLikedCheck(postId: string, userId: string) {
  pending.add(postId);
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const ids = [...pending];
    pending = new Set();
    const liked = await fetchMyLikedPostIds(userId, ids);
    if (ownerUserId !== userId) return;
    ids.forEach(id => {
      const cur = entries.get(id);
      if (cur) setEntry(id, { ...cur, liked: liked.has(id) });
    });
  }, 60);
}

/** 저장 전 임시 글(my-...)처럼 DB에 없는 글은 하트를 누를 수 없다 */
export function isLikeablePostId(postId: string): boolean {
  return !!postId && !postId.startsWith('my-');
}

export function useOunwanLike(postId: string, initialCount: number, userId: string | null | undefined) {
  resetForUser(userId ?? null);
  const [, force] = useState(0);

  useEffect(() => {
    if (!entries.has(postId)) {
      entries.set(postId, { liked: false, count: initialCount });
      if (userId && isLikeablePostId(postId)) queueLikedCheck(postId, userId);
    }
    const fn = () => force(n => n + 1);
    if (!listeners.has(postId)) listeners.set(postId, new Set());
    listeners.get(postId)!.add(fn);
    return () => { listeners.get(postId)?.delete(fn); };
  }, [postId, userId]);

  const entry = entries.get(postId) ?? { liked: false, count: initialCount };

  const toggle = useCallback(async () => {
    if (!userId || !isLikeablePostId(postId)) return false;
    const before = entries.get(postId) ?? { liked: false, count: initialCount };
    const next = { liked: !before.liked, count: Math.max(0, before.count + (before.liked ? -1 : 1)) };
    setEntry(postId, next);   // 먼저 화면에 반영하고, 실패하면 되돌린다
    try {
      if (next.liked) await likeOunwan(postId);
      else await unlikeOunwan(postId, userId);
      return true;
    } catch {
      setEntry(postId, before);
      return false;
    }
  }, [postId, userId, initialCount]);

  return { liked: entry.liked, count: entry.count, toggle };
}
