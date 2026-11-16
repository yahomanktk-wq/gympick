import { useCallback, useEffect, useState } from 'react';
import type { WorkoutFeedPost } from '../../data/types';
import { fetchUserJournalHeader, fetchUserOunwanPosts, type UserJournalHeader } from '../../lib/db/userJournal';

export function useUserJournal(userId: string) {
  const [header,  setHeader]  = useState<UserJournalHeader | null>(null);
  const [posts,   setPosts]   = useState<WorkoutFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const h = await fetchUserJournalHeader(userId);
    if (!h) {
      setHeader(null); setPosts([]); setMissing(true); setLoading(false);
      return;
    }
    setMissing(false);
    setHeader(h);
    // 비공개·차단이면 DB가 어차피 빈 목록을 주지만, 요청 자체를 생략한다
    setPosts(h.isPrivate || h.isBlocked ? [] : await fetchUserOunwanPosts(userId, h.isMe));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { header, posts, loading, missing, reload: load, setPosts };
}
