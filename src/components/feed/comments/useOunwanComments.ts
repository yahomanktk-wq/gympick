import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  fetchOunwanComments, addOunwanComment, deleteOunwanComment, OunwanComment,
} from '../../../lib/db/ounwanComments';
import { containsBannedWord } from '../../../lib/bannedWords';

// 2026-11-04: 오운완 상세의 댓글 목록 상태 (목록은 스크롤 안, 입력칸은 화면 아래에 따로 그리기 때문에 훅으로 분리)

export function useOunwanComments(postId: string) {
  const [comments, setComments] = useState<OunwanComment[]>([]);
  const [loading,  setLoading]  = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setComments(await fetchOunwanComments(postId)); }
    finally { setLoading(false); }
  }, [postId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setComments([]);
    fetchOunwanComments(postId)
      .then(list => { if (alive) setComments(list); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [postId]);

  /** 성공하면 true (입력칸 비우기용) */
  const add = useCallback(async (text: string): Promise<boolean> => {
    const banned = await containsBannedWord(text);
    if (banned) {
      Alert.alert('사용할 수 없는 표현이 있어요', '댓글 내용을 다시 확인해주세요.');
      return false;
    }
    try {
      const created = await addOunwanComment(postId, text);
      setComments(prev => [...prev, created]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return true;
    } catch (e: any) {
      // 권한 규칙 위반 = 비공개로 바뀌었거나 작성자에게 차단된 경우
      const rls = e?.code === '42501' || String(e?.message ?? '').includes('row-level security');
      Alert.alert(
        '댓글을 남기지 못했어요',
        rls ? '이 오운완에는 댓글을 남길 수 없어요.' : '잠시 후 다시 시도해주세요.',
      );
      return false;
    }
  }, [postId]);

  const remove = useCallback(async (id: string) => {
    await deleteOunwanComment(id);
    setComments(prev => prev.filter(c => c.id !== id));
  }, []);

  const removeByUser = useCallback((userId: string) => {
    setComments(prev => prev.filter(c => c.userId !== userId));
  }, []);

  return { comments, loading, add, remove, removeByUser, reload };
}
