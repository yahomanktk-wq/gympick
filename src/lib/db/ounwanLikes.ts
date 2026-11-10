import { supabase } from '../supabase';

// 2026-11-09: 오운완 하트 (이모지 리액션 5종 대체)
// - 누가 눌렀는지 저장 (ounwan_likes), 하트 수는 서버 트리거가 workout_feed_posts.like_count에 반영
// - 오운완 주인에게 알림 (같은 사람이 눌렀다 취소를 반복해도 글당 1회)
// - 나만 보기 글, 나를 차단한 사람의 글에는 누를 수 없음 (DB 권한 규칙)

export interface OunwanLiker {
  userId:    string;
  nickname:  string;
  createdAt: string;
}

/** postIds 중 내가 하트를 누른 글 id */
export async function fetchMyLikedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
  if (!userId || postIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('ounwan_likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  if (error) return new Set();
  return new Set((data ?? []).map((r: any) => r.post_id as string));
}

export async function likeOunwan(postId: string): Promise<void> {
  const { error } = await supabase.from('ounwan_likes').insert({ post_id: postId });
  if (error && error.code !== '23505') throw error;   // 이미 누른 상태면 무시
}

export async function unlikeOunwan(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('ounwan_likes').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}

/** 오운완 주인만: 하트 누른 사람 목록 */
export async function fetchOunwanLikers(postId: string): Promise<OunwanLiker[]> {
  const { data, error } = await supabase.rpc('list_ounwan_likers', { p_post_id: postId });
  if (error) return [];
  return (data ?? []).map((r: any) => ({ userId: r.user_id, nickname: r.nickname, createdAt: r.created_at }));
}
